-- ORÇAOBRA — funções de importação (só service role), fechamento de composições e busca textual.

-- Importação em lotes (o servidor valida cada lote com Zod antes de chamar) -------------------------
create or replace function public.importar_insumos(p_base uuid, p_linhas jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.insumos (base_id, codigo, descricao, unidade, tipo, classificacao, preco, origem_preco)
  select p_base, x.codigo, x.descricao, x.unidade, x.tipo, x.classificacao, x.preco, x.origem_preco
  from jsonb_to_recordset(p_linhas) as x(codigo text, descricao text, unidade text, tipo text,
    classificacao text, preco numeric, origem_preco text)
  on conflict (base_id, codigo) do update set descricao = excluded.descricao, unidade = excluded.unidade,
    tipo = excluded.tipo, classificacao = excluded.classificacao, preco = excluded.preco, origem_preco = excluded.origem_preco;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.importar_equipamentos(p_base uuid, p_linhas jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.equipamentos_custo (insumo_id, chp, chi, depreciacao, juros, manutencao, materiais_operacao, mao_obra_operacao)
  select i.id, x.chp, x.chi, x.depreciacao, x.juros, x.manutencao, x.materiais_operacao, x.mao_obra_operacao
  from jsonb_to_recordset(p_linhas) as x(codigo text, chp numeric, chi numeric, depreciacao numeric, juros numeric,
    manutencao numeric, materiais_operacao numeric, mao_obra_operacao numeric)
  join public.insumos i on i.base_id = p_base and i.codigo = x.codigo
  on conflict (insumo_id) do update set chp = excluded.chp, chi = excluded.chi, depreciacao = excluded.depreciacao,
    juros = excluded.juros, manutencao = excluded.manutencao, materiais_operacao = excluded.materiais_operacao,
    mao_obra_operacao = excluded.mao_obra_operacao;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.importar_composicoes(p_base uuid, p_linhas jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.composicoes (base_id, codigo, descricao, unidade, grupo, preco_publicado, producao_equipe, fic, fit)
  select p_base, x.codigo, x.descricao, x.unidade, x.grupo, x.preco_publicado, x.producao_equipe, x.fic, x.fit
  from jsonb_to_recordset(p_linhas) as x(codigo text, descricao text, unidade text, grupo text,
    preco_publicado numeric, producao_equipe numeric, fic numeric, fit numeric)
  on conflict (base_id, codigo) do update set descricao = excluded.descricao, unidade = excluded.unidade,
    grupo = excluded.grupo, preco_publicado = excluded.preco_publicado, producao_equipe = excluded.producao_equipe,
    fic = excluded.fic, fit = excluded.fit;
  get diagnostics n = row_count;
  return n;
end $$;

-- Itens: o vínculo (insumo/composição auxiliar) é resolvido pelo código dentro da mesma base.
-- Reenviar o mesmo lote (retomada) substitui os itens desse lote.
create or replace function public.importar_itens(p_base uuid, p_lote int, p_linhas jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.composicao_itens ci using public.composicoes c
   where ci.composicao_id = c.id and c.base_id = p_base and ci.lote_importacao = p_lote;
  insert into public.composicao_itens (composicao_id, tipo_item, item_codigo, insumo_id, composicao_aux_id, coeficiente,
    utilizacao_operativa, utilizacao_improdutiva, grupo_sicro, extra, lote_importacao)
  select c.id, x.tipo_item, x.item_codigo, i.id, ca.id, x.coeficiente, x.utilizacao_operativa,
    x.utilizacao_improdutiva, x.grupo_sicro, x.extra, p_lote
  from jsonb_to_recordset(p_linhas) as x(composicao_codigo text, tipo_item text, item_codigo text, coeficiente numeric,
    utilizacao_operativa numeric, utilizacao_improdutiva numeric, grupo_sicro text, extra jsonb)
  join public.composicoes c on c.base_id = p_base and c.codigo = x.composicao_codigo
  left join public.insumos i on x.tipo_item = 'INSUMO' and i.base_id = p_base and i.codigo = x.item_codigo
  left join public.composicoes ca on x.tipo_item = 'COMPOSICAO' and ca.base_id = p_base and ca.codigo = x.item_codigo;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.importar_encargos(p_base uuid, p_horista numeric, p_mensalista numeric) returns void
language sql security definer set search_path = '' as $$
  insert into public.encargos_sociais (base_id, horista_pct, mensalista_pct) values (p_base, p_horista, p_mensalista)
  on conflict (base_id) do update set horista_pct = excluded.horista_pct, mensalista_pct = excluded.mensalista_pct
$$;

revoke execute on function public.importar_insumos(uuid, jsonb), public.importar_equipamentos(uuid, jsonb),
  public.importar_composicoes(uuid, jsonb), public.importar_itens(uuid, int, jsonb),
  public.importar_encargos(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.importar_insumos(uuid, jsonb), public.importar_equipamentos(uuid, jsonb),
  public.importar_composicoes(uuid, jsonb), public.importar_itens(uuid, int, jsonb),
  public.importar_encargos(uuid, numeric, numeric) to service_role;

-- Fechamento: composições pedidas + auxiliares + transportes SICRO (recursivo), com insumos ----------
-- security invoker: respeita a RLS de quem chama. Números como texto para não perder precisão.
create or replace function public.fechamento_composicoes(p_base uuid, p_codigos text[]) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with recursive fech(id) as (
    select c.id from public.composicoes c where c.base_id = p_base and c.codigo = any (p_codigos)
    union
    select x.id
    from fech f
    join public.composicao_itens ci on ci.composicao_id = f.id
    cross join lateral (
      select ci.composicao_aux_id as id where ci.composicao_aux_id is not null
      union all
      select c2.id from public.composicoes c2
       where ci.extra is not null and c2.base_id = p_base
         and c2.codigo in (ci.extra ->> 'ln', ci.extra ->> 'rp', ci.extra ->> 'p')
    ) x
  ),
  itens as (
    select c.codigo as composicao_codigo, ci.*
    from fech f
    join public.composicoes c on c.id = f.id
    join public.composicao_itens ci on ci.composicao_id = f.id
  )
  select jsonb_build_object(
    'composicoes', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', c.codigo, 'descricao', c.descricao, 'unidade', c.unidade,
        'grupo', c.grupo, 'preco_publicado', c.preco_publicado::text, 'producao_equipe', c.producao_equipe::text,
        'fic', c.fic::text))
      from public.composicoes c where c.id in (select id from fech)), '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object('composicao_codigo', it.composicao_codigo, 'tipo_item', it.tipo_item,
        'item_codigo', it.item_codigo, 'coeficiente', it.coeficiente::text,
        'utilizacao_operativa', it.utilizacao_operativa::text, 'utilizacao_improdutiva', it.utilizacao_improdutiva::text,
        'grupo_sicro', it.grupo_sicro, 'extra', it.extra) order by it.id)
      from itens it), '[]'::jsonb),
    'insumos', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
        'tipo', i.tipo, 'preco', i.preco::text, 'origem_preco', i.origem_preco,
        'chp', e.chp::text, 'chi', e.chi::text))
      from public.insumos i
      left join public.equipamentos_custo e on e.insumo_id = i.id
      where i.id in (select it.insumo_id from itens it where it.insumo_id is not null)), '[]'::jsonb)
  )
$$;

-- Busca textual (trigram + full text em português) para sugerir composições no mapeamento -----------
create or replace function public.buscar_composicoes(p_base uuid, p_termo text, p_limite int default 20)
returns table (codigo text, descricao text, unidade text, preco_publicado numeric, relevancia real)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select public.f_unaccent(lower(trim(p_termo))) as termo,
           websearch_to_tsquery('portuguese'::regconfig, public.f_unaccent(trim(p_termo))) as ts
  )
  select c.codigo, c.descricao, c.unidade, c.preco_publicado,
         greatest(extensions.similarity(public.f_unaccent(lower(c.descricao)), q.termo),
                  ts_rank(c.busca, q.ts))::real as relevancia
  from public.composicoes c, q
  where c.base_id = p_base
    and (c.codigo = trim(p_termo) or c.busca @@ q.ts
         or public.f_unaccent(lower(c.descricao)) operator(extensions.%) q.termo)
  order by (c.codigo = trim(p_termo)) desc, relevancia desc
  limit least(greatest(p_limite, 1), 100)
$$;

revoke execute on function public.fechamento_composicoes(uuid, text[]), public.buscar_composicoes(uuid, text, int) from public, anon;
grant execute on function public.fechamento_composicoes(uuid, text[]), public.buscar_composicoes(uuid, text, int) to authenticated, service_role;
