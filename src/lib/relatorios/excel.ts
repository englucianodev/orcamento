/**
 * Relatórios em Excel (seção 11) a partir do modelo pronto (exceljs). Valores numéricos viram células
 * numéricas com formatos pt-BR; a conversão para número acontece só aqui, na fronteira com o Excel
 * (o arquivo .xlsx armazena números IEEE). Linhas de título congeladas; subtotais de etapa em negrito.
 */
import ExcelJS from "exceljs";
import type { ModeloRelatorio, Num } from "./tipos";
import type { TipoRelatorio } from "./tipos-relatorio";

const FMT = { dinheiro: "#,##0.00", quant: "#,##0.0000", pct: "0.00%" } as const;
type Formato = keyof typeof FMT;

interface ColunaXlsx {
  titulo: string;
  largura: number;
  formato?: Formato;
}

type Valor = string | number | Num;

interface LinhaXlsx {
  valores: readonly Valor[];
  negrito?: boolean;
}

const ehNum = (v: Valor): v is Num => typeof v === "object" && v !== null && "br" in v;

function cabecalhoDoc(m: ModeloRelatorio, titulo: string): string[] {
  const c = m.cabecalho;
  const r = c.responsavel;
  return [
    `${c.empresa.nome} — CNPJ ${c.empresa.cnpj}`,
    `${titulo} · Obra: ${c.obra} · Cliente: ${c.cliente} · ${c.municipio === "—" ? c.uf : `${c.municipio}/${c.uf}`}`,
    `Data-base: ${c.datasBase.join(" | ") || "—"} · ${c.desoneracao} · BDI serviços ${c.bdiServico.br} · BDI materiais ${c.bdiMaterial.br}`,
    `Versão ${c.versao} (${c.status}) · Emitido em ${c.dataEmissao} · Responsável técnico: ${r ? `${r.nome} · ${r.registro} · ART/RRT ${r.art}` : "__________ CREA/CAU: ______ ART/RRT: ______"}`,
  ];
}

function adicionarAba(wb: ExcelJS.Workbook, nome: string, m: ModeloRelatorio, colunas: readonly ColunaXlsx[], linhas: readonly LinhaXlsx[], notas: readonly string[] = []): void {
  const ws = wb.addWorksheet(nome);
  const topo = [...cabecalhoDoc(m, nome), ...notas];
  topo.forEach((t, i) => {
    const row = ws.addRow([t]);
    row.font = { bold: i === 0, size: i === 0 ? 12 : 9 };
  });
  ws.addRow([]);
  const titulo = ws.addRow(colunas.map((c) => c.titulo));
  titulo.font = { bold: true };
  titulo.eachCell((cel) => {
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cel.border = { bottom: { style: "thin" } };
  });
  ws.views = [{ state: "frozen", ySplit: titulo.number, xSplit: 0 }];
  colunas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.largura;
  });
  for (const l of linhas) {
    const row = ws.addRow(l.valores.map((v) => (ehNum(v) ? (v.n === null ? "—" : Number(v.n)) : v)));
    l.valores.forEach((v, i) => {
      const fmt = colunas[i]?.formato;
      if (fmt && ehNum(v) && v.n !== null) row.getCell(i + 1).numFmt = FMT[fmt];
      if (ehNum(v) || typeof v === "number") row.getCell(i + 1).alignment = { horizontal: "right" };
    });
    if (l.negrito) row.font = { bold: true };
  }
}

const COLS_SINTETICA: ColunaXlsx[] = [
  { titulo: "Item", largura: 8 }, { titulo: "Fonte/Código", largura: 15 }, { titulo: "Descrição", largura: 60 },
  { titulo: "Und", largura: 7 }, { titulo: "Quantidade", largura: 13, formato: "quant" },
  { titulo: "Custo unitário", largura: 14, formato: "quant" }, { titulo: "Preço unitário c/ BDI", largura: 16, formato: "quant" },
  { titulo: "Total", largura: 16, formato: "dinheiro" }, { titulo: "Observação", largura: 30 },
];

function abaSintetica(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const linhas: LinhaXlsx[] = m.sintetica.etapas.flatMap((e): LinhaXlsx[] => [
    { valores: [String(e.ordem), "", e.nome.toUpperCase()], negrito: true },
    ...e.itens.map((i) => ({
      valores: [i.numero, i.fonteCodigo, i.descricao, i.unidade, i.quantidade, i.custoUnitario, i.precoUnitario, i.total,
        [i.semComposicao ? "SEM COMPOSIÇÃO" : "", i.alerta ?? ""].filter(Boolean).join(" · ")],
    })),
    { valores: ["", "", `Subtotal ${e.nome}`, "", "", "", "", e.subtotal], negrito: true },
  ]);
  linhas.push({ valores: ["", "", "TOTAL GERAL (com BDI)", "", "", "", "", m.sintetica.total], negrito: true });
  adicionarAba(wb, "Sintética", m, COLS_SINTETICA, linhas, m.avisos);
}

const COLS_ANALITICA: ColunaXlsx[] = [
  { titulo: "Item", largura: 8 }, { titulo: "Fonte/Código", largura: 16 }, { titulo: "Descrição", largura: 55 },
  { titulo: "Und", largura: 7 }, { titulo: "Quant./Coef.", largura: 13, formato: "quant" },
  { titulo: "Custo unitário", largura: 14, formato: "quant" }, { titulo: "Custo total", largura: 15, formato: "dinheiro" },
  { titulo: "BDI", largura: 9 }, { titulo: "Preço unitário", largura: 14, formato: "quant" }, { titulo: "Total", largura: 16, formato: "dinheiro" },
];

function abaAnalitica(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const comps = new Map(m.composicoes.map((c) => [c.chave, c]));
  const linhas: LinhaXlsx[] = m.sintetica.etapas.flatMap((e): LinhaXlsx[] => [
    { valores: [String(e.ordem), "", e.nome.toUpperCase()], negrito: true },
    ...e.itens.flatMap((i): LinhaXlsx[] => {
      const c = i.chaveComposicao ? comps.get(i.chaveComposicao) : undefined;
      return [
        { valores: [i.numero, i.fonteCodigo, i.semComposicao ? `${i.descricao} [SEM COMPOSIÇÃO]` : i.descricao, i.unidade, i.quantidade, i.custoUnitario, i.custoTotal, i.bdiTipo, i.precoUnitario, i.total] },
        ...(c?.linhas ?? []).map((l) => ({ valores: ["", `${l.grupo} ${l.codigo}`, `   ${l.descricao}`, l.unidade, l.coeficiente, l.precoUnitario, l.total] })),
      ];
    }),
    { valores: ["", "", `Subtotal ${e.nome}`, "", "", "", e.custo, "", "", e.subtotal], negrito: true },
  ]);
  linhas.push({ valores: ["", "", "TOTAL GERAL", "", "", "", m.sintetica.custoDireto, "", "", m.sintetica.total], negrito: true });
  adicionarAba(wb, "Analítica", m, COLS_ANALITICA, linhas);
}

function abaMemoria(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const linhas = m.memoria.flatMap((g): LinhaXlsx[] => [
    { valores: ["", g.nome], negrito: true },
    ...g.itens.map((i) => ({ valores: [i.numero, i.descricao, i.unidade, i.quantidade, i.memoria] })),
  ]);
  adicionarAba(wb, "Memória", m, [
    { titulo: "Item", largura: 8 }, { titulo: "Descrição", largura: 50 }, { titulo: "Und", largura: 7 },
    { titulo: "Quantidade", largura: 13, formato: "quant" }, { titulo: "Memória de cálculo", largura: 80 },
  ], linhas);
}

function abaComposicoes(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const linhas = m.composicoes.flatMap((c): LinhaXlsx[] => [
    { valores: [c.fonteCodigo, "", c.descricao, c.unidade, "", "Custo unitário", c.custo], negrito: true },
    ...c.linhas.map((l) => ({ valores: [l.grupo, l.codigo, l.descricao, l.unidade, l.coeficiente, l.precoUnitario, l.total] })),
    ...c.resumo.map((r) => ({ valores: ["", "", r.rotulo, "", "", "", r.valor] })),
    ...c.faltantes.map((f) => ({ valores: ["", "", `Atenção: ${f}`] })),
    { valores: [] },
  ]);
  adicionarAba(wb, "Composições", m, [
    { titulo: "Tipo/Grupo", largura: 14 }, { titulo: "Código", largura: 12 }, { titulo: "Descrição", largura: 60 },
    { titulo: "Und", largura: 7 }, { titulo: "Coeficiente", largura: 13, formato: "quant" },
    { titulo: "Preço unitário", largura: 14, formato: "quant" }, { titulo: "Total", largura: 14, formato: "quant" },
  ], linhas);
}

function abaBdi(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const linhas: LinhaXlsx[] = m.bdi.quadros.flatMap((q): LinhaXlsx[] => [
    { valores: [q.rotulo, `${q.nome} (${q.tipoObra})`], negrito: true },
    ...q.componentes.map((k) => ({ valores: [k.sigla, k.nome, k.valor, k.referencia] })),
    { valores: ["BDI", "Taxa resultante", q.taxa, q.referenciaTaxa], negrito: true },
    ...q.alertas.map((a) => ({ valores: ["", `Atenção: ${a}`] })),
    { valores: [] },
  ]);
  linhas.push({ valores: ["Encargos sociais", "Base / horista / mensalista"], negrito: true });
  if (m.bdi.encargos.length === 0) linhas.push({ valores: ["", "Encargos sociais não disponíveis para as bases selecionadas."] });
  for (const e of m.bdi.encargos) linhas.push({ valores: ["", e.base, e.horista, e.mensalista] });
  adicionarAba(wb, "BDI", m, [
    { titulo: "Sigla", largura: 18 }, { titulo: "Componente", largura: 50 }, { titulo: "Valor", largura: 12, formato: "pct" },
    { titulo: "Referência TCU / Mensalista", largura: 26, formato: "pct" },
  ], linhas, ["BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − I)) − 1 (TCU, Acórdão 2622/2013)"]);
}

function abaAbc(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const linhas: LinhaXlsx[] = m.abc.linhas.map((l) => ({
    valores: [l.posicao, l.numero, l.fonteCodigo, l.descricao, l.total, l.percentual, l.acumulado, l.classe],
  }));
  linhas.push({ valores: [] });
  for (const c of m.abc.classes) linhas.push({ valores: ["", "", `Classe ${c.classe}`, `${c.itens} itens`, c.total, c.percentual], negrito: true });
  adicionarAba(wb, "Curva ABC", m, [
    { titulo: "Posição", largura: 9 }, { titulo: "Item", largura: 8 }, { titulo: "Fonte/Código", largura: 15 },
    { titulo: "Descrição", largura: 55 }, { titulo: "Total", largura: 16, formato: "dinheiro" },
    { titulo: "%", largura: 10, formato: "pct" }, { titulo: "% acumulado", largura: 12, formato: "pct" }, { titulo: "Classe", largura: 8 },
  ], linhas);
}

function abaCronograma(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const c = m.cronograma;
  const linhas: LinhaXlsx[] = [
    ...c.linhas.map((l) => ({ valores: [l.nome, l.total, ...l.valores] })),
    { valores: ["Total do mês", c.total, ...c.totaisMes], negrito: true },
    { valores: ["Acumulado", "", ...c.acumulado], negrito: true },
  ];
  const colunas: ColunaXlsx[] = [
    { titulo: "Etapa", largura: 32 }, { titulo: "Total", largura: 16, formato: "dinheiro" },
    ...c.meses.map((t) => ({ titulo: t, largura: 14, formato: "dinheiro" as const })),
  ];
  const notas = c.semDistribuicao.length ? [`Etapas sem distribuição no cronograma: ${c.semDistribuicao.join(", ")}.`] : [];
  adicionarAba(wb, "Cronograma", m, colunas, linhas, notas);
  const ws = wb.getWorksheet("Cronograma");
  const row = ws?.addRow(["% acumulado", "", ...c.percentualAcumulado.map((v) => (v.n === null ? "—" : Number(v.n)))]);
  if (row) {
    row.font = { bold: true };
    c.percentualAcumulado.forEach((v, i) => {
      if (v.n !== null) row.getCell(i + 3).numFmt = FMT.pct;
    });
  }
}

function abaResumo(wb: ExcelJS.Workbook, m: ModeloRelatorio): void {
  const i = m.indicadores;
  const linhas: LinhaXlsx[] = [
    ...m.resumoEtapas.map((r) => ({ valores: [String(r.ordem), r.nome, r.custo, r.total, r.percentual] })),
    { valores: ["", "TOTAL", i.custoDireto, i.total], negrito: true },
    { valores: [] },
    { valores: ["", "Indicadores"], negrito: true },
    { valores: ["", "BDI (valor)", "", i.valorBdi] },
    { valores: ["", "Área construída (m²)", "", i.area] },
    { valores: ["", "Custo por m²", "", i.custoM2] },
    { valores: ["", "CUB/m² informado", "", i.cub] },
    { valores: ["", "Diferença em relação ao CUB", "", "", i.diferencaCub] },
    { valores: ["", "Prazo (meses)", "", i.prazoMeses ?? "—"] },
  ];
  adicionarAba(wb, "Resumo", m, [
    { titulo: "Item", largura: 8 }, { titulo: "Etapa", largura: 45 }, { titulo: "Custo direto", largura: 16, formato: "dinheiro" },
    { titulo: "Total c/ BDI", largura: 16, formato: "dinheiro" }, { titulo: "% do total", largura: 12, formato: "pct" },
  ], linhas, m.avisos);
}

type Aba = (wb: ExcelJS.Workbook, m: ModeloRelatorio) => void;

const ABAS: Record<Exclude<TipoRelatorio, "completo">, Aba[]> = {
  proposta: [abaResumo], resumo: [abaResumo], sintetica: [abaSintetica], analitica: [abaAnalitica], memoria: [abaMemoria],
  composicoes: [abaComposicoes], bdi: [abaBdi], abc: [abaAbc], cronograma: [abaCronograma],
};

const TODAS: Aba[] = [abaSintetica, abaAnalitica, abaMemoria, abaComposicoes, abaBdi, abaAbc, abaCronograma, abaResumo];

export function montarPlanilha(modelo: ModeloRelatorio, tipo: TipoRelatorio = "completo"): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORÇAOBRA";
  wb.title = modelo.cabecalho.obra;
  for (const aba of tipo === "completo" ? TODAS : ABAS[tipo]) aba(wb, modelo);
  return wb;
}

/** Gera o .xlsx em memória. */
export async function gerarExcel(modelo: ModeloRelatorio, tipo: TipoRelatorio = "completo"): Promise<Uint8Array> {
  const buf = await montarPlanilha(modelo, tipo).xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
