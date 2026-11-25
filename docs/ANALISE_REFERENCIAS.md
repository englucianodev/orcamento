# Fase 0 — Análise das referências (`referencias/`)

Gerado com `npm run analisar-referencias` (ferramenta `tools/analisar-referencias.ts`).
Os dados brutos (inventário completo, cabeçalhos de cada aba, tabelas de validação por UF) estão em
[`ANALISE_REFERENCIAS.gerado.md`](ANALISE_REFERENCIAS.gerado.md). Este documento resume e interpreta.

## 1. Inventário

| Grupo | Arquivos | Observação |
|---|---|---|
| SINAPI | `SINAPI_Referência_2026_10.xlsx` (13,8 MB), `SINAPI_mao_de_obra_2026_10.xlsx`, `SINAPI_familias_e_coeficientes_2026_10.xlsx`, `SINAPI_Manutenções_2026_10.xlsx` | Data-base **10/2026**, todas as 27 UFs, com e sem desoneração. Ficam na raiz de `referencias/`, não em `referencias/sinapi/`. |
| SICRO | 12 relatórios `SICRO/PI 07-2026 Relatório … .xlsx` | **Somente Piauí**, data-base **07/2026**. Analítico de composições só sem desoneração; MO, equipamentos e encargos nas duas variantes. |
| Manuais | `Livro_SINAPI_Calculos_Parametros.pdf` (143 p.), `Livro_SINAPI_Metodologias_Conceitos.pdf` (113 p.) | Encargos sociais/complementares; metodologia de composições, %AS, custo horário de equipamentos. |
| Orçamentos do escritório | **nenhum** | Pasta `orcamentos/` não existe. |
| Projetos / memoriais | **nenhum** | Pasta `projetos/` não existe. |
| Modelos de relatório | **nenhum** | Pasta `modelos/` não existe. |
| Manual DNIT de custos | **nenhum** | Fórmula SICRO conferida diretamente no relatório analítico (seção 3). |

Nenhum arquivo contém dados de clientes. Nenhum texto dentro dos arquivos foi interpretado como instrução.

## 2. SINAPI — layout "Referência" (2025+)

Um único arquivo com todas as UFs em colunas. É o layout que o parser `sinapi-referencia-2025` lê.

| Aba | Conteúdo | Cabeçalho | Detalhes |
|---|---|---|---|
| `ISD` / `ICD` / `ISE` | Insumos sem desoneração / com desoneração / sem encargos | `Classificação · Código do Insumo · Descrição do Insumo · Unidade · Origem de Preço · AC … TO` | Linhas do topo: fator de encargos **Horista** e **Mensalista** por UF (1,1378 = 113,78%) e `Mês de Referência: 10/2026`. 5.038 insumos. |
| `CSD` / `CCD` / `CSE` | Custos de composições | `Grupo · Código da Composição · Descrição · Unidade · [Custo (R$) · %AS] × 27` | A UF fica na linha **acima** do cabeçalho, em colunas alternadas. O código é a fórmula `=HYPERLINK(…,104658)` com valor em cache **0**; o leitor extrai o último argumento. 10.710 composições. |
| `Analítico` | Itens das composições | `Grupo · Código da Composição · Tipo Item · Código do Item · Descrição · Unidade · Coeficiente · Situação` | Linha da composição (Tipo vazio) seguida dos itens `INSUMO`/`COMPOSICAO`. 57.096 itens. |
| `Menu`, `Busca`, `Analítico com Custo` | Navegação | — | Ignoradas. |

Classificação de insumo → tipo do sistema: MATERIAL → `MATERIAL`; MAO DE OBRA e ENCARGOS COMPLEMENTARES →
`MAO_OBRA`; EQUIPAMENTO (…) → `EQUIPAMENTO`; SERVIÇOS e ESPECIAIS → `SERVICO`. A classificação original fica
em `insumos.classificacao`.

Arquivos auxiliares (`mao_de_obra`, `familias_e_coeficientes`, `Manutenções`) não são necessários para
precificar; o de manutenções ajuda a explicar diferenças na reprecificação.

### 2.1 Regras de cálculo descobertas (validação por recálculo)

1. **Truncamento por linha.** O custo publicado é Σ **trunc₂(coeficiente × preço)**, recursivo nas
   auxiliares. Com arredondamento comum ou precisão total, só uma parte das composições confere.
2. **%AS.** Insumo sem coleta mínima na UF usa o **preço de São Paulo** (1.353 insumos em PI). Sem essa
   regra, metade das composições fica "sem custo".
3. **Custo 0 = sem custo.** 2.193 composições são publicadas com 0 (SEM CUSTO/EM ESTUDO) e usam insumos
   fora da lista; o sistema as trata como "sem custo".

Resultado: todas as composições com custo conferem (± R$ 0,01) nas 27 UFs, com e sem desoneração
(8.515 a 8.517 composições comparadas por base, 54 bases, nenhuma divergência). Detalhe por UF em `ANALISE_REFERENCIAS.gerado.md`. Encargos lidos, por
exemplo: PI 113,78% / 71,59% (não desonerado).

## 3. SICRO — relatórios por UF (layout `sicro-relatorios-2024`)

| Arquivo | Layout | Uso |
|---|---|---|
| Relatório Analítico de Composições de Custos | Blocos por composição. Cabeçalho com UF por extenso (`Piauí`), `FIC` + valor, mês (`Julho/2026`), `Produção da equipe` + valor + unidade, código (7 dígitos) e descrição. Seções **A** equipamentos (qtd, util. operativa, improdutiva, CHP, CHI), **B** mão de obra, **C** material, **D** atividades auxiliares, **E** tempo fixo (material, composição de carga, qtd), **F** momento de transporte (material, qtd, composições de transporte LN/RP/P). Fecha com `Custo unitário direto total`. | Composições e itens |
| Sintético de Equipamentos (±desoneração) | `Código · Descrição · Valor de Aquisição · Depreciação · Oportunidade de Capital · Seguros e Impostos · Manutenção · Operação · Mão de Obra de Operação · Custo Produtivo · Custo Improdutivo` | `equipamentos_custo` |
| Sintético de Mão de Obra (±desoneração) | `Código · Descrição · Unidade · Custo (R$)` | insumos MAO_OBRA |
| Sintético de Materiais | `Código · Descrição · Unidade · Preço Unitário (R$)` | insumos MATERIAL |
| Sintético de Composições | `Código · Descrição do Serviço · Unidade · Custo Unitário (R$)` | preço publicado (conferência) |
| Analítico de Encargos (±desoneração) | Grupos A–D por profissão + `Total (%)` | encargos (valor mais frequente) |
| Analítico de MO, Origem de Preços | Detalhamento salarial / origem | Informativo, não importado |

### 3.1 Fórmula SICRO conferida

- custo horário = Σ equip. qtd × (util.op × CHP + util.improd × CHI) + Σ MO qtd × custo/h
- execução = custo horário / produção
- **FIC = FIC × (Σ equip. qtd × CHI + custo horário de MO) / produção** (incide sobre o custo improdutivo)
- unitário = execução + FIC + C + D + E + F; linhas com 4 casas, total com 2.
- No relatório oficial a DMT vem em branco (F = 0); a DMT é dado da obra (LN, RP, P em km).

Resultado (PI, não desonerado): **6.260 de 6.264 composições conferem**. As 4 divergências (0903803,
0919002, 0919210, 7119788) são de mobilização/canteiro, com acréscimo de exatamente 10% ou 5% que não
aparece nas seções A–F. Outras 355 composições usam material sem preço no sintético (publicado como R$ 0):
o sistema mostra "sem custo".

## 4. Orçamentos do escritório, índices reais e mapeamento

**Não há orçamentos, projetos, memoriais nem modelos** na pasta. Consequências:

- **Índices reais não puderam ser calculados.** O seed usa os valores-padrão da seção 7 do prompt, todos
  editáveis em *Configurações → Índices*, marcados como "não calibrado".
- **Mapeamento serviço → código:** o seed fica **sem códigos** (não inventar). A tela de mapeamento sugere
  composições por busca textual para o engenheiro confirmar.
- **Caso de aceite 7** (orçamento real reproduzido) fica **pendente** até haver um orçamento em
  `referencias/orcamentos/`.
- **Padrões de acabamento e relatórios** seguem as seções 6.3 e 11 do prompt.

## 5. Conflitos com o prompt

1. **Arredondamento SINAPI.** O prompt pede arredondar só no total do item; o SINAPI **trunca** cada linha
   da composição. Adotado: o motor de composições usa `truncar_2` (configurável); o orçamento arredonda só
   o total de cada item (2 casas), com preços unitários de 4 casas.
2. **FIC do SICRO.** O prompt diz `execução × FIC`; o relatório oficial usa o custo improdutivo (3.1).
   Adotado o do relatório.
3. **%AS.** Não previsto no prompt; implementado na importação.
4. **Pastas.** SINAPI está na raiz e a pasta SICRO é `SICRO/`; a ferramenta varre tudo.
5. **Datas-base diferentes.** SINAPI 10/2026 e SICRO 07/2026. Adotado: **alerta** (não bloqueio) ao misturar.
6. **SICRO desonerado.** O DNIT só publica o analítico sem desoneração; a base desonerada é recalculada.
7. **Biblioteca de planilhas.** O npm deste ambiente bloqueia o pacote oficial do SheetJS e o exceljs no
   navegador carregaria ~2,5 milhões de células. Criado `xlsx-leitor.ts` (JSZip + XML), que lê o SINAPI
   inteiro em ~2,5 s. O exceljs continua para **exportar** Excel.
8. **Dependências.** `npm audit` aponta PostCSS embutido no Next 15 e `uuid` dentro do exceljs (função não
   usada). Registrado para acompanhamento.

## 6. Dúvidas

1. Obras com SINAPI + SICRO: aceitar datas-base diferentes com alerta (adotado) ou exigir a mesma?
2. Os acréscimos de 10%/5% das 4 composições SICRO divergentes: há documento DNIT a incluir?
3. Envie orçamentos reais (ficam fora do Git) para calibrar índices e o mapeamento.
4. Encargos SICRO variam por profissão; guardamos o valor mais frequente só para exibição. Confirma?

## 7. Fixtures (`tests/fixtures/`, dados públicos oficiais)

- `sinapi-pi-2026-10-amostra.json` — fechamento de 5 composições (com auxiliares) em PI.
- `sicro-pi-2026-07-amostra.json` — fechamento de 3 composições SICRO (A–F).
- `sinapi-aba-{isd,csd,analitico}-recorte.json` — primeiras linhas das abas para testar os parsers.
