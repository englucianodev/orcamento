-- ORÇAOBRA — endurecimento após a revisão de segurança e de código:
--  * status / versão / aprovação só mudam por aprovar_orcamento e reabrir_orcamento (marca de operação
--    válida só na transação); o orçamento aprovado só aceita trocar nome e cliente;
--  * versões só são gravadas por essas funções; reabrir passa a registrar o motivo (faltava política de update);
--  * orçamento aprovado não pode ser excluído;
--  * salvar_calculo: campos + itens + cronograma numa só transação; cronograma com 6 casas;
--  * convite só é aceito com e-mail confirmado; a empresa mantém pelo menos um administrador.

-- Marca de operação interna (set_config local à transação; o cliente não chama set_config pela API) --
create or replace function public.operacao_orcamento() returns text
language sql stable set search_path = '' as $$
  select coalesce(current_setting('app.operacao_orcamento', true), '')
$$;

create or replace function public.bloquear_orcamento_aprovado() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_op text := public.operacao_orcamento();
  v_livres text[] := array['nome', 'cliente', 'atualizado_em'];
begin
  if (new.status = 'aprovado') is distinct from (old.status = 'aprovado')
     or new.versao is distinct from old.versao
     or new.aprovado_em is distinct from old.aprovado_em
     or new.aprovado_por is distinct from old.aprovado_por then
    if (new.status = 'aprovado' and v_op = 'aprovar') or (old.status = 'aprovado' and v_op = 'reabrir') then
      return new;
    end if;
    raise exception 'Status, versão e aprovação só mudam por aprovar_orcamento ou reabrir_orcamento.' using errcode = '42501';
  end if;
  if old.status = 'aprovado' and (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres) then
    raise exception 'Orçamento aprovado: crie uma nova versão para alterar.' using errcode = '42501';
  end if;
  return new;
end $$;

-- Versões: só as funções de aprovação gravam (o update é necessário para o motivo da reabertura)
create or replace function public.bloquear_versao_direta() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.operacao_orcamento() not in ('aprovar', 'reabrir') then
    raise exception 'Versões só são gravadas por aprovar_orcamento ou reabrir_orcamento.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger orcamento_versoes_bloqueio before insert or update on public.orcamento_versoes
  for each row execute function public.bloquear_versao_direta();
create policy versoes_update on public.orcamento_versoes for update to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.pode_editar(o.empresa_id)))
  with check (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.pode_editar(o.empresa_id)));

-- Orçamento aprovado não é excluído
drop policy orcamentos_delete on public.orcamentos;
create policy orcamentos_delete on public.orcamentos for delete to authenticated
  using (public.is_admin_empresa(empresa_id) and status <> 'aprovado');

-- Aprovar / reabrir com a marca de operação --------------------------------------------------------
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
  perform set_config('app.operacao_orcamento', 'aprovar', true);
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
  perform set_config('app.operacao_orcamento', '', true);
  return v_orc.versao;
end $$;

create or replace function public.reabrir_orcamento(p_orcamento uuid, p_motivo text default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare v_orc public.orcamentos%rowtype;
begin
  select * into v_orc from public.orcamentos where id = p_orcamento for update;
  if not found or not public.pode_editar(v_orc.empresa_id) then
    raise exception 'Sem permissão para alterar este orçamento.' using errcode = '42501';
  end if;
  if v_orc.status <> 'aprovado' then raise exception 'Só um orçamento aprovado pode ser reaberto.'; end if;
  perform set_config('app.operacao_orcamento', 'reabrir', true);
  update public.orcamento_versoes set motivo = coalesce(motivo || ' | ', '') || 'reaberto: ' || coalesce(p_motivo, 'sem motivo informado')
   where orcamento_id = p_orcamento and versao = v_orc.versao;
  update public.orcamentos set status = 'rascunho', versao = versao + 1, aprovado_em = null, aprovado_por = null where id = p_orcamento;
  perform set_config('app.operacao_orcamento', '', true);
  return v_orc.versao + 1;
end $$;

-- Cálculo gravado de uma vez: campos (data-base, desoneração, entrada), itens e cronograma ----------
alter table public.cronograma alter column percentual type numeric(9, 6);

create or replace function public.salvar_calculo(p_orcamento uuid, p_itens jsonb, p_resumo jsonb, p_cronograma jsonb, p_campos jsonb default '{}')
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.orcamentos o where o.id = p_orcamento and public.pode_editar(o.empresa_id)) then
    raise exception 'Sem permissão para editar este orçamento.' using errcode = '42501';
  end if;
  if p_campos <> '{}'::jsonb then
    update public.orcamentos set
      mes_base = case when p_campos ? 'mes_base' then (p_campos ->> 'mes_base')::date else mes_base end,
      mes_base_sicro = case when p_campos ? 'mes_base_sicro' then (p_campos ->> 'mes_base_sicro')::date else mes_base_sicro end,
      desonerado = case when p_campos ? 'desonerado' then (p_campos ->> 'desonerado')::boolean else desonerado end,
      entrada = case when p_campos ? 'entrada' then p_campos -> 'entrada' else entrada end
    where id = p_orcamento;
  end if;
  perform public.salvar_itens_orcamento(p_orcamento, p_itens, p_resumo);
  perform public.salvar_cronograma(p_orcamento, p_cronograma);
end $$;

revoke execute on function public.salvar_calculo(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_calculo(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- Convite: exige e-mail confirmado ------------------------------------------------------------------
create or replace function public.aceitar_convite(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_conv public.convites%rowtype;
begin
  if v_user is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null) then
    raise exception 'Confirme o seu e-mail antes de aceitar o convite.' using errcode = '42501';
  end if;
  select * into v_conv from public.convites where token = p_token and aceito_em is null for update;
  if not found then raise exception 'Convite inválido ou já utilizado.'; end if;
  if v_conv.email <> v_email then raise exception 'Este convite foi enviado para outro e-mail.'; end if;
  insert into public.membros (empresa_id, user_id, papel) values (v_conv.empresa_id, v_user, v_conv.papel)
    on conflict (empresa_id, user_id) do update set papel = excluded.papel;
  update public.convites set aceito_em = now(), aceito_por = v_user where id = v_conv.id;
  return v_conv.empresa_id;
end $$;

-- A empresa mantém pelo menos um administrador (exclusão da própria empresa em cascata é permitida) --
create or replace function public.manter_um_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.papel = 'admin' and (tg_op = 'DELETE' or new.papel <> 'admin' or new.empresa_id <> old.empresa_id)
     and exists (select 1 from public.empresas e where e.id = old.empresa_id)
     and not exists (select 1 from public.membros m
                      where m.empresa_id = old.empresa_id and m.papel = 'admin' and m.user_id <> old.user_id) then
    raise exception 'A empresa precisa de pelo menos um administrador.';
  end if;
  return coalesce(new, old);
end $$;
create trigger membros_um_admin before update or delete on public.membros
  for each row execute function public.manter_um_admin();
