-- ORÇAOBRA — operações atômicas do orçamento e lista de membros com e-mail.

-- Membros com e-mail (auth.users não é legível pelo cliente) -----------------------------------------
create or replace function public.membros_da_empresa(p_empresa uuid)
returns table (user_id uuid, email text, nome text, papel text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, (u.raw_user_meta_data ->> 'nome')::text, m.papel
  from public.membros m join auth.users u on u.id = m.user_id
  where m.empresa_id = p_empresa and public.is_membro(p_empresa)
  order by u.email
$$;
revoke execute on function public.membros_da_empresa(uuid) from public, anon;
grant execute on function public.membros_da_empresa(uuid) to authenticated;

-- Substitui os itens do orçamento numa transação (security invoker: a RLS de quem chama vale) -------
create or replace function public.salvar_itens_orcamento(p_orcamento uuid, p_itens jsonb, p_resumo jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.orcamentos o where o.id = p_orcamento and public.pode_editar(o.empresa_id)) then
    raise exception 'Sem permissão para editar este orçamento.' using errcode = '42501';
  end if;
  delete from public.orcamento_itens where orcamento_id = p_orcamento;
  insert into public.orcamento_itens (orcamento_id, etapa, numero, chave_servico, ambiente_id, fonte, codigo, descricao,
    unidade, quantidade, quantidade_calculada, memoria_calculo, fator_conversao, custo_unitario, editado_manual, bdi_tipo, alerta, ordem)
  select p_orcamento, x.etapa, x.numero, x.chave_servico, x.ambiente_id, x.fonte, x.codigo, x.descricao, x.unidade,
    x.quantidade, x.quantidade_calculada, x.memoria_calculo, coalesce(x.fator_conversao, 1), x.custo_unitario,
    coalesce(x.editado_manual, false), x.bdi_tipo, x.alerta, x.ordem
  from jsonb_to_recordset(p_itens) as x(etapa text, numero text, chave_servico text, ambiente_id text, fonte text, codigo text,
    descricao text, unidade text, quantidade numeric, quantidade_calculada numeric, memoria_calculo text, fator_conversao numeric,
    custo_unitario numeric, editado_manual boolean, bdi_tipo text, alerta text, ordem int);
  update public.orcamentos set
    total = (p_resumo ->> 'total')::numeric,
    area_construida = (p_resumo ->> 'area_construida')::numeric,
    status = case when status = 'aprovado' then status else 'revisao' end
  where id = p_orcamento;
end $$;

create or replace function public.salvar_cronograma(p_orcamento uuid, p_linhas jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.orcamentos o where o.id = p_orcamento and public.pode_editar(o.empresa_id)) then
    raise exception 'Sem permissão para editar este orçamento.' using errcode = '42501';
  end if;
  delete from public.cronograma where orcamento_id = p_orcamento;
  insert into public.cronograma (orcamento_id, etapa, mes, percentual)
  select p_orcamento, x.etapa, x.mes, x.percentual
  from jsonb_to_recordset(p_linhas) as x(etapa text, mes int, percentual numeric);
end $$;

-- Aprovação: exige todos os itens com custo, congela e grava a versão -------------------------------
create or replace function public.aprovar_orcamento(p_orcamento uuid, p_motivo text default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare
  v_orc public.orcamentos%rowtype;
  v_sem int;
begin
  select * into v_orc from public.orcamentos where id = p_orcamento for update;
  if not found or not public.pode_editar(v_orc.empresa_id) then
    raise exception 'Sem permissão para aprovar este orçamento.' using errcode = '42501';
  end if;
  if v_orc.status = 'aprovado' then raise exception 'O orçamento já está aprovado.'; end if;
  select count(*) into v_sem from public.orcamento_itens
   where orcamento_id = p_orcamento and custo_unitario is null and coalesce(unidade, '') <> '%';
  if v_sem > 0 then
    raise exception '% item(ns) sem composição ou sem custo: mapeie antes de aprovar.', v_sem;
  end if;
  if not exists (select 1 from public.orcamento_itens where orcamento_id = p_orcamento) then
    raise exception 'O orçamento não tem itens.';
  end if;
  update public.orcamentos set status = 'aprovado', aprovado_em = now(), aprovado_por = auth.uid() where id = p_orcamento;
  insert into public.orcamento_versoes (orcamento_id, versao, status, total, snapshot, motivo)
  select o.id, o.versao, 'aprovado', o.total,
    jsonb_build_object(
      'orcamento', to_jsonb(o) - 'entrada',
      'entrada', o.entrada,
      'itens', coalesce((select jsonb_agg(to_jsonb(i) order by i.ordem) from public.orcamento_itens i where i.orcamento_id = o.id), '[]'),
      'cronograma', coalesce((select jsonb_agg(to_jsonb(c)) from public.cronograma c where c.orcamento_id = o.id), '[]')
    ), p_motivo
  from public.orcamentos o where o.id = p_orcamento
  on conflict (orcamento_id, versao) do update set status = excluded.status, total = excluded.total,
    snapshot = excluded.snapshot, motivo = excluded.motivo, criado_em = now();
  return v_orc.versao;
end $$;

-- Reabrir: a versão aprovada fica no histórico e o orçamento segue como nova versão em rascunho ------
create or replace function public.reabrir_orcamento(p_orcamento uuid, p_motivo text default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare v_orc public.orcamentos%rowtype;
begin
  select * into v_orc from public.orcamentos where id = p_orcamento for update;
  if not found or not public.pode_editar(v_orc.empresa_id) then
    raise exception 'Sem permissão para alterar este orçamento.' using errcode = '42501';
  end if;
  if v_orc.status <> 'aprovado' then raise exception 'Só um orçamento aprovado pode ser reaberto.'; end if;
  update public.orcamento_versoes set motivo = coalesce(motivo || ' | ', '') || 'reaberto: ' || coalesce(p_motivo, 'sem motivo informado')
   where orcamento_id = p_orcamento and versao = v_orc.versao;
  update public.orcamentos set status = 'rascunho', versao = versao + 1, aprovado_em = null, aprovado_por = null where id = p_orcamento;
  return v_orc.versao + 1;
end $$;

revoke execute on function public.salvar_itens_orcamento(uuid, jsonb, jsonb), public.salvar_cronograma(uuid, jsonb),
  public.aprovar_orcamento(uuid, text), public.reabrir_orcamento(uuid, text) from public, anon;
grant execute on function public.salvar_itens_orcamento(uuid, jsonb, jsonb), public.salvar_cronograma(uuid, jsonb),
  public.aprovar_orcamento(uuid, text), public.reabrir_orcamento(uuid, text) to authenticated;
