# ORÇAOBRA

Orçamentos de obras residenciais **por cômodo**, com preços das bases oficiais **SINAPI** e **SICRO**.
O engenheiro descreve a obra num assistente de 10 passos; o sistema calcula os quantitativos (com memória
de cálculo em cada quantidade), aplica as composições mapeadas, o BDI (fórmula do TCU) e gera planilha,
curva ABC, cronograma físico-financeiro e relatórios em PDF e Excel.

Stack: Next.js 15 (App Router) · TypeScript estrito · Tailwind v4 · TanStack Table · Supabase (Postgres,
Auth, Storage, RLS) · Zod + react-hook-form · decimal.js · exceljs · @react-pdf/renderer · Vitest · Playwright.

## Regras que o código segue

- **RLS em todas as tabelas.** `SUPABASE_SERVICE_ROLE_KEY` só existe no servidor (nunca `NEXT_PUBLIC_`),
  usada apenas na importação das bases, depois de conferir que o usuário é administrador da plataforma.
- **Nenhum código SINAPI/SICRO é inventado.** O mapeamento serviço → composição é uma tabela editável
  (Configurações → Mapeamento), que começa vazia; a tela sugere composições por busca para o engenheiro confirmar.
- **Dinheiro com decimal.js.** Preço unitário com 4 casas; só o total de cada item é arredondado (2 casas).
- **Números de engenharia em tabelas editáveis** (índices, padrões, tabelas paramétricas, BDI), nunca fixos no código.
- **Orçamento aprovado é imutável**: alterar exige reabrir, o que cria uma nova versão (histórico com cópia completa).
- A pasta `referencias/` (planilhas oficiais completas e dados de clientes) **não vai para o Git**.

## Instalação local

Pré-requisitos: Node 22+, npm e (para o banco local) a [CLI do Supabase](https://supabase.com/docs/guides/local-development).

```bash
npm install
cp .env.example .env.local      # preencha com as chaves do seu projeto
npx tsx tools/gerar-seed.ts     # (re)gera supabase/seed.sql a partir do motor
supabase start                  # banco local (opcional)
supabase db reset               # aplica migrations + seed no banco local
npm run dev
```

Variáveis (`.env.example`, sem valores reais):

| Variável | Onde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor | chave pública (a RLS protege os dados) |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | importação das bases oficiais |
| `NEXT_PUBLIC_SITE_URL` | servidor | URL pública (link mágico e convites) |

## Testes

```bash
npm run lint
npm run typecheck
npm test                 # unidade (motor) + integração (migrations reais num Postgres em memória, PGlite)
npm run test:coverage    # meta: 80% no motor (src/lib/engine)
npm run test:e2e         # Playwright; precisa de um projeto Supabase de TESTE
```

Os testes de integração aplicam as migrations e o seed num Postgres WASM (PGlite) com um shim do Supabase
(papéis `anon`/`authenticated`/`service_role`, `auth.uid()`, Storage) e conferem RLS entre empresas,
permissões das funções, importação em lotes, fechamento de composições, aprovação e versões.

E2E: defina `E2E_EMAIL` e `E2E_SENHA` (usuário de teste que já tem empresa). O caso de aceite 8 completo
(gerar planilha e exportar PDF) roda com `E2E_BASE_IMPORTADA=true` e `E2E_UF` quando o projeto de teste
tiver base SINAPI importada e mapeamento configurado.

## Importação web do SINAPI e do SICRO

Feita por um **administrador da plataforma** em *Admin · Bases*:

1. Baixe as planilhas oficiais (SINAPI: arquivo "Referência" do mês; SICRO: relatórios analíticos da UF).
2. Escolha fonte, UF e desoneração e selecione os arquivos. A leitura acontece **no navegador** (Web Worker),
   com barra de progresso; nada é gravado antes de você confirmar.
3. O sistema valida por **recálculo**: cada composição recalculada é comparada com o preço publicado
   (tolerância de R$ 0,01) e mostra o relatório de divergências.
4. Ao confirmar, os arquivos originais vão para o Storage privado e os dados são gravados em **lotes de até
   1.000 linhas**. Se a conexão cair, selecione o mesmo arquivo de novo e use **Retomar**: os lotes são
   idempotentes. A base só fica disponível para orçamentos ao final (`importado_em`).
5. Em *Bases* qualquer usuário consulta insumos e composições (analítica) por UF e data-base.

Depois da primeira importação, configure em *Configurações → Mapeamento* qual composição atende cada serviço
do catálogo (por padrão de acabamento, se quiser). Itens sem mapeamento aparecem com alerta e **bloqueiam a
aprovação** do orçamento.

## Deploy

1. Crie o repositório no GitHub (o `.gitignore` já exclui `.env*` e `referencias/`).
2. Crie o projeto no Supabase e aplique migrations e seed:
   ```bash
   supabase link --project-ref <ref-do-projeto>
   supabase db push --include-seed
   ```
3. Importe o repositório na Vercel e cadastre as variáveis da tabela acima
   (`SUPABASE_SERVICE_ROLE_KEY` só como variável de servidor). Faça o deploy.
4. No Supabase → Authentication → URL Configuration: *Site URL* = domínio da Vercel e, em *Redirect URLs*,
   `https://<seu-dominio>/auth/callback` (e `http://localhost:3000/auth/callback` para desenvolvimento).
   Em Authentication → Providers → Email, mantenha **Confirm email** ligado: o aceite de convite exige e-mail
   confirmado; com a confirmação desligada, qualquer um poderia criar conta com o e-mail de um convidado.
5. Cadastre o primeiro administrador da plataforma (SQL Editor do Supabase), depois de criar a conta no app:
   ```sql
   insert into public.admins_plataforma (user_id)
   select id from auth.users where email = '<email-do-administrador>';
   ```
6. O GitHub Actions (`.github/workflows/ci.yml`) roda lint, tipos, testes e build em todo push/PR. O job de E2E
   só roda com a variável de repositório `E2E_HABILITADO=true` e os secrets `E2E_*` de um projeto de teste
   (`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_EMAIL`, `E2E_SENHA`).

## Estrutura

```
src/lib/engine/        motor puro: geometria, quantitativos, preços SINAPI/SICRO, BDI, cronograma, ABC
src/lib/importacao/    leitura das planilhas oficiais, lotes e validação
src/lib/orcamento/     ligação motor ↔ banco: mapeamento, fechamento, recálculo, carregamento e visões
src/lib/relatorios/    modelo dos relatórios, PDF e Excel
src/app/(app)/         painel, assistente, orçamento (abas), bases, configurações, empresa, admin
supabase/migrations/   esquema, RLS, funções de importação/fechamento/busca, operações do orçamento
tools/                 gerador do seed e análise das referências
docs/                  ANALISE_REFERENCIAS.md (Fase 0: layouts, regras, conflitos e dúvidas)
```

## Pendências conhecidas

- **Caso de aceite 7** (reproduzir um orçamento real): aguarda orçamentos em `referencias/orcamentos/`;
  até lá os índices usam os valores-padrão do prompt, marcados como não calibrados.
- Conflitos e dúvidas sobre as referências estão em `docs/ANALISE_REFERENCIAS.md`.
