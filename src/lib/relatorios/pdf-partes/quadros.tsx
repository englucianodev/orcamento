/** Seções de quadros do PDF: proposta comercial, resumo/custo por m², BDI e encargos, curva ABC e cronograma. */
import { Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { ModeloRelatorio, Num } from "../tipos";
import { Assinatura, Avisos, T, Tabela, est, h, local, textoPdf, type Coluna, type LinhaTabela } from "./base";

const COLS_RESUMO: Coluna[] = [
  { titulo: "Item", largura: 8 }, { titulo: "Etapa", largura: 46 }, { titulo: "Custo direto", largura: 16, direita: true },
  { titulo: "Total c/ BDI", largura: 18, direita: true }, { titulo: "% do total", largura: 12, direita: true },
];

function tabelaResumo(m: ModeloRelatorio): ReactElement {
  const linhas: LinhaTabela[] = m.resumoEtapas.map((r) => ({ celulas: [String(r.ordem), r.nome, r.custo.br, r.total.br, r.percentual.br] }));
  linhas.push({ celulas: ["", "TOTAL", m.indicadores.custoDireto.br, m.indicadores.total.br, m.resumoEtapas.length ? "100,00%" : "—"], estilo: "subtotal" });
  return h(Tabela, { colunas: COLS_RESUMO, linhas });
}

function tabelaIndicadores(m: ModeloRelatorio): ReactElement {
  const i = m.indicadores;
  const linhas: Array<[string, string]> = [
    ["Custo direto (sem BDI)", `R$ ${i.custoDireto.br}`],
    ["BDI (valor)", `R$ ${i.valorBdi.br}`],
    ["Preço total (com BDI)", `R$ ${i.total.br}`],
    ["Área construída", i.area.n ? `${i.area.br} m²` : "—"],
    ["Custo por m²", i.custoM2.n ? `R$ ${i.custoM2.br}/m²` : "—"],
    ["CUB/m² informado", i.cub.n ? `R$ ${i.cub.br}/m²` : "— (não informado)"],
    ["Diferença em relação ao CUB", i.diferencaCub.br],
    ["Prazo (cronograma)", i.prazoMeses ? `${i.prazoMeses} ${i.prazoMeses === 1 ? "mês" : "meses"}` : "—"],
  ];
  return h(Tabela, {
    colunas: [{ titulo: "Indicador", largura: 60 }, { titulo: "Valor", largura: 40, direita: true }],
    linhas: linhas.map((l) => ({ celulas: l })),
  });
}

export function Resumo({ m }: { m: ModeloRelatorio }): ReactElement {
  return h(View, null,
    T("Resumo por etapa e custo por m²", est.h1),
    h(Avisos, { avisos: m.avisos }),
    tabelaResumo(m),
    T("Indicadores", est.h2),
    tabelaIndicadores(m),
  );
}

export function Proposta({ m }: { m: ModeloRelatorio }): ReactElement {
  const c = m.cabecalho;
  const dados: Array<[string, string]> = [
    ["Cliente", c.cliente], ["Obra", c.obra], ["Local", local(c)], ["Padrão de acabamento", c.padrao],
    ["Data-base", c.datasBase.join(" | ") || "—"], ["Regime", c.desoneracao],
    ["BDI serviços / materiais", `${c.bdiServico.br} / ${c.bdiMaterial.br}`],
    ["Prazo estimado", m.indicadores.prazoMeses ? `${m.indicadores.prazoMeses} meses` : "—"],
  ];
  return h(View, null,
    T("Proposta comercial", est.h1),
    ...dados.map(([k, v]) => h(Text, { style: est.p }, h(Text, { style: est.negrito }, textoPdf(`${k}: `)), textoPdf(v))),
    T("Valor por etapa", est.h2),
    tabelaResumo(m),
    T(`Valor global da proposta: R$ ${m.indicadores.total.br}`, [est.h2, { fontSize: 11 }]),
    h(Avisos, { avisos: m.avisos }),
    T(`${c.empresa.nome} · CNPJ ${c.empresa.cnpj} · ${c.dataEmissao}`),
    h(Assinatura, { c }),
  );
}

const COLS_BDI: Coluna[] = [
  { titulo: "Sigla", largura: 10 }, { titulo: "Componente", largura: 45 }, { titulo: "Valor", largura: 15, direita: true },
  { titulo: "Referência TCU", largura: 30, direita: true },
];

export function Bdi({ m }: { m: ModeloRelatorio }): ReactElement {
  const encargos = m.bdi.encargos.length === 0
    ? T("Encargos sociais não disponíveis para as bases selecionadas.")
    : h(Tabela, {
      colunas: [{ titulo: "Base", largura: 50 }, { titulo: "Horista", largura: 25, direita: true }, { titulo: "Mensalista", largura: 25, direita: true }],
      linhas: m.bdi.encargos.map((e) => ({ celulas: [e.base, e.horista.br, e.mensalista.br] })),
    });
  return h(View, null,
    T("BDI e encargos sociais", est.h1),
    T("Fórmula (TCU, Acórdão 2622/2013): BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 - I)) - 1"),
    m.bdi.quadros.length === 0 ? T("Nenhum BDI configurado para o orçamento.") : null,
    ...m.bdi.quadros.map((q) => h(View, { wrap: false },
      T(`${q.rotulo} — ${q.nome} (${q.tipoObra})`, est.h2),
      h(Tabela, {
        colunas: COLS_BDI,
        linhas: [
          ...q.componentes.map((k) => ({ celulas: [k.sigla, k.nome, k.valor.br, k.referencia] })),
          { celulas: ["BDI", "Taxa resultante", q.taxa.br, q.referenciaTaxa], estilo: "subtotal" as const },
        ],
      }),
      h(Avisos, { avisos: q.alertas }),
    )),
    T("Encargos sociais das bases", est.h2),
    encargos,
  );
}

const COLS_ABC: Coluna[] = [
  { titulo: "Pos.", largura: 5 }, { titulo: "Item", largura: 7 }, { titulo: "Fonte/Código", largura: 12 },
  { titulo: "Descrição", largura: 40 }, { titulo: "Total", largura: 13, direita: true },
  { titulo: "%", largura: 8, direita: true }, { titulo: "% acum.", largura: 9, direita: true }, { titulo: "Classe", largura: 6 },
];

export function Abc({ m }: { m: ModeloRelatorio }): ReactElement {
  return h(View, null,
    T("Curva ABC dos serviços", est.h1),
    T("Classe A até 80% do valor acumulado; B até 95%; C o restante."),
    h(Tabela, {
      colunas: [{ titulo: "Classe", largura: 25 }, { titulo: "Itens", largura: 15, direita: true }, { titulo: "Total", largura: 35, direita: true }, { titulo: "%", largura: 25, direita: true }],
      linhas: m.abc.classes.map((c) => ({ celulas: [c.classe, String(c.itens), c.total.br, c.percentual.br] })),
    }),
    h(Tabela, {
      colunas: COLS_ABC,
      linhas: m.abc.linhas.map((l) => ({ celulas: [String(l.posicao), l.numero, l.fonteCodigo, l.descricao, l.total.br, l.percentual.br, l.acumulado.br, l.classe] })),
    }),
  );
}

const MESES_POR_TABELA = 8;

const fatia = (valores: readonly Num[], inicio: number): string[] => valores.slice(inicio, inicio + MESES_POR_TABELA).map((v) => v.br);

export function Cronograma({ m }: { m: ModeloRelatorio }): ReactElement {
  const c = m.cronograma;
  const blocos = Array.from({ length: Math.ceil(c.meses.length / MESES_POR_TABELA) }, (_, i) => i * MESES_POR_TABELA);
  return h(View, null,
    T("Cronograma físico-financeiro", est.h1),
    c.semDistribuicao.length ? h(Avisos, { avisos: [`Etapas sem distribuição no cronograma (recalcule o orçamento): ${c.semDistribuicao.join(", ")}.`] }) : null,
    c.meses.length === 0 ? T("Cronograma ainda não gerado para este orçamento.") : null,
    ...blocos.map((inicio) => {
      const meses = c.meses.slice(inicio, inicio + MESES_POR_TABELA);
      const colunas: Coluna[] = [
        { titulo: "Etapa", largura: 18 }, { titulo: "Total", largura: 12, direita: true },
        ...meses.map((t) => ({ titulo: t, largura: 70 / meses.length, direita: true })),
      ];
      const linhas: LinhaTabela[] = [
        ...c.linhas.map((l) => ({ celulas: [l.nome, l.total.br, ...fatia(l.valores, inicio)] })),
        { celulas: ["Total do mês", c.total.br, ...fatia(c.totaisMes, inicio)], estilo: "subtotal" },
        { celulas: ["Acumulado", "", ...fatia(c.acumulado, inicio)], estilo: "subtotal" },
        { celulas: ["% acumulado", "", ...fatia(c.percentualAcumulado, inicio)], estilo: "subtotal" },
      ];
      return h(Tabela, { colunas, linhas });
    }),
  );
}
