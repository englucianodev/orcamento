-- ORÇAOBRA — esquema (seção 4 do prompt, com os ajustes registrados em docs/ANALISE_REFERENCIAS.md)
-- Ajustes: insumos.classificacao; composicao_itens guarda tipo/código do item (vínculo resolvido na
-- importação) e extra jsonb (SICRO E/F); tabelas_parametricas; bdi_faixas; convites; orcamento_versoes.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent imutável (necessário para índices e colunas geradas)
create or replace function public.f_unaccent(texto text) returns text
language sql immutable parallel safe strict set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, texto) $$;

-- Multiempresa ---------------------------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  cnpj text,
  logo_path text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

create table public.membros (
  empresa_id uuid not null references public.empresas on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  papel text not null check (papel in ('admin', 'orcamentista', 'leitor')),
  criado_em timestamptz not null default now(),
  primary key (empresa_id, user_id)
);
create index membros_user_idx on public.membros (user_id);

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas on delete cascade,
  email text not null check (email = lower(email)),
  papel text not null check (papel in ('admin', 'orcamentista', 'leitor')),
  token uuid not null unique default gen_random_uuid(),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  aceito_por uuid references auth.users on delete set null,
  unique (empresa_id, email)
);

create table public.admins_plataforma (
  user_id uuid primary key references auth.users on delete cascade
);

-- Bases oficiais (leitura para autenticados; escrita só no servidor com service role) ----------
create table public.bases_referencia (
  id uuid primary key default gen_random_uuid(),
  fonte text not null check (fonte in ('SINAPI', 'SICRO')),
  uf char(2) not null,
  mes_ano date not null check (extract(day from mes_ano) = 1),
  desonerado boolean not null,
  layout text,
  arquivo_hash text unique,
  arquivo_path text,
  avisos jsonb not null default '[]',
  validacao jsonb,
  importado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (fonte, uf, mes_ano, desonerado)
);

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  base_id uuid references public.bases_referencia on delete cascade,
  etapa text check (etapa in ('insumos', 'equipamentos', 'composicoes', 'itens', 'encargos', 'validacao')),
  lote_atual int not null default 0,
  total_lotes int,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluida', 'erro', 'cancelada')),
  erros jsonb not null default '[]',
  iniciado_por uuid,
  iniciado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.insumos (
  id bigserial primary key,
  base_id uuid not null references public.bases_referencia on delete cascade,
  codigo text not null,
  descricao text,
  unidade text,
  tipo text check (tipo in ('MATERIAL', 'MAO_OBRA', 'EQUIPAMENTO', 'SERVICO', 'TRANSPORTE')),
  classificacao text,
  preco numeric(18, 4),
  origem_preco text,
  unique (base_id, codigo)
);
create index insumos_desc_trgm on public.insumos using gin (public.f_unaccent(lower(descricao)) extensions.gin_trgm_ops);

create table public.equipamentos_custo (
  insumo_id bigint primary key references public.insumos on delete cascade,
  chp numeric(18, 4),
  chi numeric(18, 4),
  depreciacao numeric(18, 4),
  juros numeric(18, 4),
  manutencao numeric(18, 4),
  materiais_operacao numeric(18, 4),
  mao_obra_operacao numeric(18, 4)
);

create table public.composicoes (
  id bigserial primary key,
  base_id uuid references public.bases_referencia on delete cascade,
  empresa_id uuid references public.empresas on delete cascade, -- null = oficial; preenchido = própria
  codigo text not null,
  descricao text,
  unidade text,
  grupo text,
  preco_publicado numeric(18, 4),
  producao_equipe numeric, -- SICRO
  fic numeric,
  fit numeric,
  busca tsvector generated always as (
    to_tsvector('portuguese'::regconfig, public.f_unaccent(coalesce(codigo, '') || ' ' || coalesce(descricao, '')))
  ) stored,
  check (base_id is not null or empresa_id is not null),
  unique (base_id, codigo)
);
create index composicoes_busca_idx on public.composicoes using gin (busca);
create index composicoes_desc_trgm on public.composicoes using gin (public.f_unaccent(lower(descricao)) extensions.gin_trgm_ops);
create unique index composicoes_proprias_uk on public.composicoes (empresa_id, codigo) where base_id is null;

create table public.composicao_itens (
  id bigserial primary key,
  composicao_id bigint not null references public.composicoes on delete cascade,
  tipo_item text not null check (tipo_item in ('INSUMO', 'COMPOSICAO')),
  item_codigo text not null,
  insumo_id bigint references public.insumos on delete cascade,
  composicao_aux_id bigint references public.composicoes on delete cascade,
  coeficiente numeric not null,
  utilizacao_operativa numeric,
  utilizacao_improdutiva numeric,
  grupo_sicro char(1) check (grupo_sicro in ('A', 'B', 'C', 'D', 'E', 'F')),
  extra jsonb,
  lote_importacao int,
  -- o vínculo pode ficar vazio quando o item não consta da publicação (composição "sem custo")
  check (num_nonnulls(insumo_id, composicao_aux_id) <= 1)
);
create index composicao_itens_comp_idx on public.composicao_itens (composicao_id);
create index composicao_itens_aux_idx on public.composicao_itens (composicao_aux_id) where composicao_aux_id is not null;
create index composicao_itens_insumo_idx on public.composicao_itens (insumo_id) where insumo_id is not null;

create table public.encargos_sociais (
  base_id uuid primary key references public.bases_referencia on delete cascade,
  horista_pct numeric(8, 4),
  mensalista_pct numeric(8, 4)
);

-- Configuração (valores-semente globais quando empresa_id is null) -----------------------------
create table public.padroes_acabamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas on delete cascade,
  padrao text not null check (padrao in ('baixo', 'normal', 'alto', 'luxo')),
  config jsonb not null,
  unique nulls not distinct (empresa_id, padrao)
);

create table public.indices_parametricos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas on delete cascade,
  chave text not null,
  valor numeric not null,
  unidade text,
  descricao text,
  origem text,
  unique nulls not distinct (empresa_id, chave)
);

create table public.tabelas_parametricas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas on delete cascade,
  chave text not null,
  config jsonb not null,
  unique nulls not distinct (empresa_id, chave)
);

create table public.servicos_catalogo (
  chave text primary key,
  descricao text not null,
  unidade text not null,
  etapa text not null,
  ordem int,
  bdi_tipo text not null default 'servico' check (bdi_tipo in ('servico', 'material'))
);

create table public.servicos_mapeamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas on delete cascade,
  chave text not null references public.servicos_catalogo on delete cascade,
  padrao text check (padrao in ('baixo', 'normal', 'alto', 'luxo')),
  fonte text not null check (fonte in ('SINAPI', 'SICRO', 'PROPRIA')),
  codigo text not null,
  fator_conversao numeric not null default 1 check (fator_conversao > 0),
  unique nulls not distinct (empresa_id, chave, padrao, fonte)
);

create table public.bdi_config (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas on delete cascade,
  nome text not null,
  tipo_obra text not null default 'edificacoes',
  ac numeric not null, s numeric not null, r numeric not null, g numeric not null,
  df numeric not null, l numeric not null, i numeric not null check (i < 1),
  tipo text not null check (tipo in ('servico', 'material'))
);

create table public.bdi_faixas (
  id uuid primary key default gen_random_uuid(),
  tipo_obra text not null,
  componente text not null check (componente in ('ac', 's_g', 'r', 'df', 'l', 'i', 'bdi')),
  minimo numeric not null,
  medio numeric not null,
  maximo numeric not null,
  origem text,
  unique (tipo_obra, componente)
);

-- Orçamentos -------------------------------------------------------------------------------------
create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas on delete cascade,
  nome text not null,
  cliente text,
  uf char(2),
  mes_base date,
  mes_base_sicro date,
  desonerado boolean,
  padrao text,
  entrada jsonb not null, -- descrição completa da obra (Zod da seção 6), com "versao"
  etapa_assistente int not null default 1,
  status text not null default 'rascunho' check (status in ('rascunho', 'revisao', 'aprovado')),
  versao int not null default 1,
  bdi_servico_id uuid references public.bdi_config on delete set null,
  bdi_material_id uuid references public.bdi_config on delete set null,
  cub_m2 numeric(18, 2),
  area_construida numeric(18, 2),
  dmt jsonb not null default '{"ln": 0, "rp": 0, "p": 0}',
  responsavel jsonb, -- { nome, registro (CREA/CAU), art }
  total numeric(18, 2),
  aprovado_em timestamptz,
  aprovado_por uuid,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index orcamentos_empresa_idx on public.orcamentos (empresa_id, atualizado_em desc);

create table public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos on delete cascade,
  etapa text,
  numero text,
  chave_servico text,
  ambiente_id text,
  fonte text,
  codigo text,
  descricao text,
  unidade text,
  quantidade numeric(18, 4),
  quantidade_calculada numeric(18, 4),
  memoria_calculo text,
  fator_conversao numeric not null default 1,
  custo_unitario numeric(18, 4), -- congelado ao aprovar
  editado_manual boolean not null default false,
  bdi_tipo text check (bdi_tipo in ('servico', 'material')),
  alerta text,
  ordem int
);
create index orcamento_itens_orc_idx on public.orcamento_itens (orcamento_id, ordem);

create table public.orcamento_versoes (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos on delete cascade,
  versao int not null,
  status text not null,
  total numeric(18, 2),
  snapshot jsonb not null,
  motivo text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (orcamento_id, versao)
);

create table public.cronograma (
  orcamento_id uuid not null references public.orcamentos on delete cascade,
  etapa text not null,
  mes int not null check (mes >= 1),
  percentual numeric(6, 3) not null,
  primary key (orcamento_id, etapa, mes)
);

-- atualizado_em automático
create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger orcamentos_atualizado before update on public.orcamentos
  for each row execute function public.tocar_atualizado_em();
create trigger importacoes_atualizado before update on public.importacoes
  for each row execute function public.tocar_atualizado_em();
