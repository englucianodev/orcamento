-- ORÇAOBRA — Row Level Security em todas as tabelas, funções de acesso e buckets de Storage.

-- Funções de acesso (security definer, sem recursão nas políticas) -----------------------------
create or replace function public.is_membro(empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros m where m.empresa_id = empresa and m.user_id = (select auth.uid()))
$$;

create or replace function public.papel_em(empresa uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.papel from public.membros m where m.empresa_id = empresa and m.user_id = (select auth.uid())
$$;

create or replace function public.pode_editar(empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.papel_em(empresa) in ('admin', 'orcamentista'), false)
$$;

create or replace function public.is_admin_empresa(empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.papel_em(empresa) = 'admin', false)
$$;

create or replace function public.is_admin_plataforma() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins_plataforma a where a.user_id = (select auth.uid()))
$$;

revoke execute on function public.is_membro(uuid), public.papel_em(uuid), public.pode_editar(uuid),
  public.is_admin_empresa(uuid), public.is_admin_plataforma() from public, anon;
grant execute on function public.is_membro(uuid), public.papel_em(uuid), public.pode_editar(uuid),
  public.is_admin_empresa(uuid), public.is_admin_plataforma() to authenticated;

-- Criação de empresa: quem cria vira admin ---------------------------------------------------------
create or replace function public.criar_empresa(p_nome text, p_cnpj text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Nome da empresa inválido.'; end if;
  insert into public.empresas (nome, cnpj, criado_por) values (trim(p_nome), nullif(trim(p_cnpj), ''), v_user)
    returning id into v_id;
  insert into public.membros (empresa_id, user_id, papel) values (v_id, v_user, 'admin');
  return v_id;
end $$;

-- Aceite de convite: o e-mail do convite precisa ser o do usuário logado
create or replace function public.aceitar_convite(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_conv public.convites%rowtype;
begin
  if v_user is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  select * into v_conv from public.convites where token = p_token and aceito_em is null for update;
  if not found then raise exception 'Convite inválido ou já utilizado.'; end if;
  if v_conv.email <> v_email then raise exception 'Este convite foi enviado para outro e-mail.'; end if;
  insert into public.membros (empresa_id, user_id, papel) values (v_conv.empresa_id, v_user, v_conv.papel)
    on conflict (empresa_id, user_id) do update set papel = excluded.papel;
  update public.convites set aceito_em = now(), aceito_por = v_user where id = v_conv.id;
  return v_conv.empresa_id;
end $$;

revoke execute on function public.criar_empresa(text, text), public.aceitar_convite(uuid) from public, anon;
grant execute on function public.criar_empresa(text, text), public.aceitar_convite(uuid) to authenticated;

-- Habilita RLS em todas as tabelas ------------------------------------------------------------------
alter table public.empresas enable row level security;
alter table public.membros enable row level security;
alter table public.convites enable row level security;
alter table public.admins_plataforma enable row level security;
alter table public.bases_referencia enable row level security;
alter table public.importacoes enable row level security;
alter table public.insumos enable row level security;
alter table public.equipamentos_custo enable row level security;
alter table public.composicoes enable row level security;
alter table public.composicao_itens enable row level security;
alter table public.encargos_sociais enable row level security;
alter table public.padroes_acabamento enable row level security;
alter table public.indices_parametricos enable row level security;
alter table public.tabelas_parametricas enable row level security;
alter table public.servicos_catalogo enable row level security;
alter table public.servicos_mapeamento enable row level security;
alter table public.bdi_config enable row level security;
alter table public.bdi_faixas enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;
alter table public.orcamento_versoes enable row level security;
alter table public.cronograma enable row level security;

-- Empresas e membros
create policy empresas_select on public.empresas for select to authenticated using (public.is_membro(id));
create policy empresas_update on public.empresas for update to authenticated
  using (public.is_admin_empresa(id)) with check (public.is_admin_empresa(id));

create policy membros_select on public.membros for select to authenticated using (public.is_membro(empresa_id));
create policy membros_update on public.membros for update to authenticated
  using (public.is_admin_empresa(empresa_id)) with check (public.is_admin_empresa(empresa_id));
create policy membros_delete on public.membros for delete to authenticated
  using (public.is_admin_empresa(empresa_id) or user_id = (select auth.uid()));

create policy convites_select on public.convites for select to authenticated using (public.is_admin_empresa(empresa_id));
create policy convites_insert on public.convites for insert to authenticated with check (public.is_admin_empresa(empresa_id));
create policy convites_delete on public.convites for delete to authenticated using (public.is_admin_empresa(empresa_id));

create policy admins_select on public.admins_plataforma for select to authenticated using (user_id = (select auth.uid()));

-- Bases oficiais: leitura para autenticados; escrita só pela service role (sem política de escrita)
create policy bases_select on public.bases_referencia for select to authenticated using (true);
create policy insumos_select on public.insumos for select to authenticated using (true);
create policy equipamentos_select on public.equipamentos_custo for select to authenticated using (true);
create policy encargos_select on public.encargos_sociais for select to authenticated using (true);
create policy importacoes_select on public.importacoes for select to authenticated using (public.is_admin_plataforma());

create policy composicoes_select on public.composicoes for select to authenticated
  using (empresa_id is null or public.is_membro(empresa_id));
create policy composicoes_insert on public.composicoes for insert to authenticated
  with check (empresa_id is not null and base_id is null and public.pode_editar(empresa_id));
create policy composicoes_update on public.composicoes for update to authenticated
  using (empresa_id is not null and public.pode_editar(empresa_id))
  with check (empresa_id is not null and base_id is null and public.pode_editar(empresa_id));
create policy composicoes_delete on public.composicoes for delete to authenticated
  using (empresa_id is not null and public.pode_editar(empresa_id));

create policy comp_itens_select on public.composicao_itens for select to authenticated using (
  exists (select 1 from public.composicoes c where c.id = composicao_id and (c.empresa_id is null or public.is_membro(c.empresa_id)))
);
create policy comp_itens_write on public.composicao_itens for all to authenticated
  using (exists (select 1 from public.composicoes c where c.id = composicao_id and c.empresa_id is not null and public.pode_editar(c.empresa_id)))
  with check (exists (select 1 from public.composicoes c where c.id = composicao_id and c.empresa_id is not null and public.pode_editar(c.empresa_id)));

-- Configurações: semente global (empresa_id null) legível por todos; a empresa edita as suas
create policy padroes_select on public.padroes_acabamento for select to authenticated using (empresa_id is null or public.is_membro(empresa_id));
create policy padroes_write on public.padroes_acabamento for all to authenticated
  using (empresa_id is not null and public.pode_editar(empresa_id)) with check (empresa_id is not null and public.pode_editar(empresa_id));
create policy indices_select on public.indices_parametricos for select to authenticated using (empresa_id is null or public.is_membro(empresa_id));
create policy indices_write on public.indices_parametricos for all to authenticated
  using (empresa_id is not null and public.pode_editar(empresa_id)) with check (empresa_id is not null and public.pode_editar(empresa_id));
create policy tabelas_select on public.tabelas_parametricas for select to authenticated using (empresa_id is null or public.is_membro(empresa_id));
create policy tabelas_write on public.tabelas_parametricas for all to authenticated
  using (empresa_id is not null and public.pode_editar(empresa_id)) with check (empresa_id is not null and public.pode_editar(empresa_id));
create policy mapeamento_select on public.servicos_mapeamento for select to authenticated using (empresa_id is null or public.is_membro(empresa_id));
create policy mapeamento_write on public.servicos_mapeamento for all to authenticated
  using (empresa_id is not null and public.pode_editar(empresa_id)) with check (empresa_id is not null and public.pode_editar(empresa_id));
create policy bdi_select on public.bdi_config for select to authenticated using (empresa_id is null or public.is_membro(empresa_id));
create policy bdi_write on public.bdi_config for all to authenticated
  using (empresa_id is not null and public.pode_editar(empresa_id)) with check (empresa_id is not null and public.pode_editar(empresa_id));
create policy catalogo_select on public.servicos_catalogo for select to authenticated using (true);
create policy faixas_select on public.bdi_faixas for select to authenticated using (true);

-- Orçamentos
create policy orcamentos_select on public.orcamentos for select to authenticated using (public.is_membro(empresa_id));
create policy orcamentos_insert on public.orcamentos for insert to authenticated with check (public.pode_editar(empresa_id));
create policy orcamentos_update on public.orcamentos for update to authenticated
  using (public.pode_editar(empresa_id)) with check (public.pode_editar(empresa_id));
create policy orcamentos_delete on public.orcamentos for delete to authenticated using (public.is_admin_empresa(empresa_id));

create policy orc_itens_select on public.orcamento_itens for select to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.is_membro(o.empresa_id)));
create policy orc_itens_write on public.orcamento_itens for all to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.pode_editar(o.empresa_id)))
  with check (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.pode_editar(o.empresa_id)));
create policy versoes_select on public.orcamento_versoes for select to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.is_membro(o.empresa_id)));
create policy versoes_insert on public.orcamento_versoes for insert to authenticated
  with check (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.pode_editar(o.empresa_id)));
create policy cronograma_select on public.cronograma for select to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.is_membro(o.empresa_id)));
create policy cronograma_write on public.cronograma for all to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.pode_editar(o.empresa_id)))
  with check (exists (select 1 from public.orcamentos o where o.id = orcamento_id and public.pode_editar(o.empresa_id)));

-- Orçamento aprovado é imutável: alterações exigem nova versão (reabrir)
create or replace function public.bloquear_aprovado() returns trigger
language plpgsql set search_path = '' as $$
declare v_status text;
begin
  select status into v_status from public.orcamentos where id = coalesce(new.orcamento_id, old.orcamento_id);
  if v_status = 'aprovado' then
    raise exception 'Orçamento aprovado: crie uma nova versão para alterar.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger orcamento_itens_bloqueio before insert or update or delete on public.orcamento_itens
  for each row execute function public.bloquear_aprovado();
create trigger cronograma_bloqueio before insert or update or delete on public.cronograma
  for each row execute function public.bloquear_aprovado();

create or replace function public.bloquear_orcamento_aprovado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'aprovado' and new.status = 'aprovado' and (
    new.entrada is distinct from old.entrada or new.bdi_servico_id is distinct from old.bdi_servico_id
    or new.bdi_material_id is distinct from old.bdi_material_id or new.mes_base is distinct from old.mes_base
    or new.desonerado is distinct from old.desonerado or new.total is distinct from old.total
  ) then
    raise exception 'Orçamento aprovado: crie uma nova versão para alterar.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger orcamentos_bloqueio before update on public.orcamentos
  for each row execute function public.bloquear_orcamento_aprovado();

-- Storage: bucket privado das planilhas oficiais (upload direto do navegador pelo admin da plataforma)
insert into storage.buckets (id, name, public, file_size_limit)
values ('bases-oficiais', 'bases-oficiais', false, 209715200), ('logos', 'logos', false, 2097152)
on conflict (id) do nothing;

create policy bases_oficiais_select on storage.objects for select to authenticated
  using (bucket_id = 'bases-oficiais' and public.is_admin_plataforma());
create policy bases_oficiais_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'bases-oficiais' and public.is_admin_plataforma());
create policy bases_oficiais_delete on storage.objects for delete to authenticated
  using (bucket_id = 'bases-oficiais' and public.is_admin_plataforma());

-- logos: caminho "<empresa_id>/logo.<ext>"
create policy logos_select on storage.objects for select to authenticated
  using (bucket_id = 'logos' and public.is_membro(((storage.foldername(name))[1])::uuid));
create policy logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_admin_empresa(((storage.foldername(name))[1])::uuid));
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_admin_empresa(((storage.foldername(name))[1])::uuid));
create policy logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.is_admin_empresa(((storage.foldername(name))[1])::uuid));
