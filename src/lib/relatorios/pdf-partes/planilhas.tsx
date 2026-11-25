/** Seções de planilha do PDF: sintética, analítica, memória por ambiente e composições analíticas. */
import { View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { ComposicaoRelatorio, LinhaSintetica, ModeloRelatorio } from "../tipos";
import { Avisos, T, Tabela, est, h, type Coluna, type LinhaTabela } from "./base";

const descricaoItem = (i: LinhaSintetica): string => `${i.descricao}${i.semComposicao ? " [SEM COMPOSIÇÃO]" : ""}`;

const COLS_SINTETICA: Coluna[] = [
  { titulo: "Item", largura: 6 }, { titulo: "Fonte/Código", largura: 11 }, { titulo: "Descrição", largura: 39 },
  { titulo: "Und", largura: 5 }, { titulo: "Quant.", largura: 8, direita: true }, { titulo: "Custo unit.", largura: 9, direita: true },
  { titulo: "Preço unit. c/ BDI", largura: 10, direita: true }, { titulo: "Total", largura: 12, direita: true },
];

export function Sintetica({ m }: { m: ModeloRelatorio }): ReactElement {
  const linhas: LinhaTabela[] = m.sintetica.etapas.flatMap((e): LinhaTabela[] => [
    { celulas: [String(e.ordem), "", e.nome.toUpperCase()], estilo: "grupo" },
    ...e.itens.map((i): LinhaTabela => ({
      celulas: [i.numero, i.fonteCodigo, descricaoItem(i), i.unidade, i.quantidade.br, i.custoUnitario.br, i.precoUnitario.br, i.total.br],
      estilo: i.semComposicao ? "alerta" : "normal",
    })),
    { celulas: ["", "", `Subtotal ${e.nome}`, "", "", "", "", e.subtotal.br], estilo: "subtotal" },
  ]);
  linhas.push({ celulas: ["", "", "TOTAL GERAL (com BDI)", "", "", "", "", m.sintetica.total.br], estilo: "subtotal" });
  return h(View, null,
    T("Planilha orçamentária sintética", est.h1),
    T(`BDI serviços: ${m.cabecalho.bdiServico.br} · BDI materiais: ${m.cabecalho.bdiMaterial.br} · Valores em R$`),
    h(Avisos, { avisos: m.avisos }),
    h(Tabela, { colunas: COLS_SINTETICA, linhas }),
  );
}

const COLS_ANALITICA: Coluna[] = [
  { titulo: "Item", largura: 6 }, { titulo: "Fonte/Código", largura: 10 }, { titulo: "Descrição", largura: 30 },
  { titulo: "Und", largura: 5 }, { titulo: "Quant./Coef.", largura: 8, direita: true }, { titulo: "Custo unit.", largura: 8, direita: true },
  { titulo: "Custo total", largura: 9, direita: true }, { titulo: "BDI", largura: 6 },
  { titulo: "Preço unit.", largura: 8, direita: true }, { titulo: "Total", largura: 10, direita: true },
];

function linhasComposicao(c: ComposicaoRelatorio | undefined): LinhaTabela[] {
  if (!c) return [];
  return [
    ...c.linhas.map((l): LinhaTabela => ({
      celulas: ["", `${l.grupo} ${l.codigo}`, l.descricao, l.unidade, l.coeficiente.br, l.precoUnitario.br, l.total.br], estilo: "detalhe",
    })),
    ...c.faltantes.map((f): LinhaTabela => ({ celulas: ["", "", f], estilo: "alerta" })),
  ];
}

export function Analitica({ m }: { m: ModeloRelatorio }): ReactElement {
  const comps = new Map(m.composicoes.map((c) => [c.chave, c]));
  const linhas: LinhaTabela[] = m.sintetica.etapas.flatMap((e): LinhaTabela[] => [
    { celulas: [String(e.ordem), "", e.nome.toUpperCase()], estilo: "grupo" },
    ...e.itens.flatMap((i): LinhaTabela[] => [
      {
        celulas: [i.numero, i.fonteCodigo, descricaoItem(i), i.unidade, i.quantidade.br, i.custoUnitario.br, i.custoTotal.br, i.bdiTipo, i.precoUnitario.br, i.total.br],
        estilo: i.semComposicao ? "alerta" : "normal",
      },
      ...linhasComposicao(i.chaveComposicao ? comps.get(i.chaveComposicao) : undefined),
    ]),
    { celulas: ["", "", `Subtotal ${e.nome}`, "", "", "", e.custo.br, "", "", e.subtotal.br], estilo: "subtotal" },
  ]);
  linhas.push({ celulas: ["", "", "TOTAL GERAL", "", "", "", m.sintetica.custoDireto.br, "", "", m.sintetica.total.br], estilo: "subtotal" });
  return h(View, null,
    T("Planilha orçamentária analítica", est.h1),
    T("Cada item é seguido dos insumos e composições auxiliares da composição de referência (coeficiente × preço)."),
    h(Avisos, { avisos: m.avisos }),
    h(Tabela, { colunas: COLS_ANALITICA, linhas }),
  );
}

const COLS_MEMORIA: Coluna[] = [
  { titulo: "Item", largura: 8 }, { titulo: "Descrição", largura: 34 }, { titulo: "Und", largura: 6 },
  { titulo: "Quant.", largura: 10, direita: true }, { titulo: "Memória de cálculo", largura: 42 },
];

export function Memoria({ m }: { m: ModeloRelatorio }): ReactElement {
  return h(View, null,
    T("Memória de cálculo por ambiente", est.h1),
    m.memoria.length === 0 ? T("Nenhum item com quantitativo.") : null,
    ...m.memoria.map((g) => h(View, null,
      T(g.nome, est.h2),
      h(Tabela, { colunas: COLS_MEMORIA, linhas: g.itens.map((it) => ({ celulas: [it.numero, it.descricao, it.unidade, it.quantidade.br, it.memoria] })) }),
    )),
  );
}

const COLS_COMPOSICAO: Coluna[] = [
  { titulo: "Tipo/Grupo", largura: 11 }, { titulo: "Código", largura: 10 }, { titulo: "Descrição", largura: 44 },
  { titulo: "Und", largura: 7 }, { titulo: "Coeficiente", largura: 10, direita: true },
  { titulo: "Preço unit.", largura: 9, direita: true }, { titulo: "Total", largura: 9, direita: true },
];

function blocoComposicao(c: ComposicaoRelatorio): ReactElement {
  return h(View, { style: { marginBottom: 8 } },
    T(`${c.fonteCodigo} — ${c.descricao} (${c.unidade}) · Custo unitário: ${c.custo.br}`, est.h2),
    c.linhas.length
      ? h(Tabela, { colunas: COLS_COMPOSICAO, linhas: c.linhas.map((l) => ({ celulas: [l.grupo, l.codigo, l.descricao, l.unidade, l.coeficiente.br, l.precoUnitario.br, l.total.br] })) })
      : null,
    ...c.resumo.map((r) => T(`${r.rotulo}: ${r.valor.br}`)),
    h(Avisos, { avisos: c.faltantes }),
  );
}

export function Composicoes({ m }: { m: ModeloRelatorio }): ReactElement {
  return h(View, null,
    T("Composições analíticas", est.h1),
    m.composicoes.length === 0 ? T("Nenhuma composição de referência disponível para os itens.") : null,
    ...m.composicoes.map(blocoComposicao),
  );
}
