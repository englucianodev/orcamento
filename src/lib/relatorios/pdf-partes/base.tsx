/**
 * Peças comuns dos PDFs (@react-pdf/renderer, fontes Helvetica embutidas — sem busca de fonte na rede):
 * cabeçalho com logo, rodapé com paginação e responsável técnico, tabela simples.
 * Escrito com `createElement` (sem JSX): o tsconfig usa `jsx: preserve` (Next), o que impede o
 * Vitest de transformar JSX — assim o PDF também é testado em node.
 */
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { createElement as h, type ReactElement } from "react";
import type { CabecalhoRelatorio } from "../tipos";

export { h };

// A hifenização padrão do react-pdf é para inglês: em pt-BR só quebramos linha entre palavras.
Font.registerHyphenationCallback((palavra) => [palavra]);

/** "Teresina/PI", ou só "PI" quando o município não foi informado. */
export const local = (c: CabecalhoRelatorio): string => (c.municipio === "—" ? c.uf : `${c.municipio}/${c.uf}`);

export interface LogoPdf {
  data: Buffer;
  format: "png" | "jpg";
}

export const COR = { tinta: "#1f2937", suave: "#6b7280", borda: "#d1d5db", fundo: "#f3f4f6", acento: "#1e3a8a", aviso: "#92400e" };

export const est = StyleSheet.create({
  pagina: { paddingTop: 92, paddingBottom: 48, paddingHorizontal: 28, fontFamily: "Helvetica", fontSize: 8, color: COR.tinta },
  cabecalho: { position: "absolute", top: 20, left: 28, right: 28, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COR.acento, paddingBottom: 6 },
  logo: { maxHeight: 44, maxWidth: 110, marginRight: 10, objectFit: "contain" },
  empresa: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  linhaCab: { fontSize: 7.5, color: COR.suave },
  tituloDoc: { fontFamily: "Helvetica-Bold", fontSize: 9, color: COR.acento, textAlign: "right" },
  rodape: { position: "absolute", bottom: 18, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: COR.borda, paddingTop: 4, fontSize: 7, color: COR.suave },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 6, color: COR.acento },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 3, lineHeight: 1.35 },
  aviso: { color: COR.aviso, marginBottom: 2 },
  negrito: { fontFamily: "Helvetica-Bold" },
  tabela: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: COR.borda, marginBottom: 6 },
  linha: { flexDirection: "row" },
  cel: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: COR.borda, paddingVertical: 2, paddingHorizontal: 3 },
  titulo: { backgroundColor: COR.fundo, fontFamily: "Helvetica-Bold" },
  grupo: { backgroundColor: "#e0e7ff", fontFamily: "Helvetica-Bold" },
  subtotal: { backgroundColor: COR.fundo, fontFamily: "Helvetica-Bold" },
  detalhe: { color: COR.suave, fontSize: 7 },
  alerta: { color: COR.aviso },
  assinatura: { marginTop: 36, width: 240, borderTopWidth: 0.75, borderTopColor: COR.tinta, paddingTop: 3 },
});

const SUBSTITUTOS: Record<string, string> = {
  "−": "-", "→": "->", "←": "<-", "≤": "<=", "≥": ">=", "≠": "<>", "⌈": "", "⌉": "", "⌊": "", "⌋": "", "Σ": "soma ", "√": "raiz ", "∑": "soma ",
};
const PERMITIDOS = /[\u0000-ÿ–—‘’“”•…€]/;

/** Helvetica embutida só tem WinAnsi: troca símbolos comuns e marca com "?" o que não pode ser desenhado. */
export function textoPdf(s: string): string {
  let saida = "";
  for (const ch of s) saida += SUBSTITUTOS[ch] ?? (PERMITIDOS.test(ch) ? ch : "?");
  return saida;
}

/** Parágrafo de texto já saneado. */
export const T = (texto: string, estilo: Style | Style[] = est.p): ReactElement => h(Text, { style: estilo }, textoPdf(texto));

export function Cabecalho({ c, titulo, logo }: { c: CabecalhoRelatorio; titulo: string; logo?: LogoPdf | null }): ReactElement {
  return h(View, { style: est.cabecalho, fixed: true },
    logo ? h(Image, { style: est.logo, src: logo }) : null,
    h(View, { style: { flexGrow: 1 } },
      T(c.empresa.nome, est.empresa),
      T(`CNPJ: ${c.empresa.cnpj}`, est.linhaCab),
      T(`Obra: ${c.obra} · Cliente: ${c.cliente} · ${local(c)}`, est.linhaCab),
      T(`Data-base: ${c.datasBase.join(" | ") || "—"} · ${c.desoneracao}`, est.linhaCab),
    ),
    h(View, { style: { width: 180 } },
      T(titulo, est.tituloDoc),
      T(`Versão ${c.versao} · ${c.status} · Emitido em ${c.dataEmissao}`, [est.linhaCab, { textAlign: "right" }]),
    ),
  );
}

export function Rodape({ c }: { c: CabecalhoRelatorio }): ReactElement {
  const r = c.responsavel;
  const resp = r
    ? `Responsável técnico: ${r.nome} · ${r.registro} · ART/RRT ${r.art}`
    : "Responsável técnico: ________________________  CREA/CAU: __________  ART/RRT: __________";
  return h(View, { style: est.rodape, fixed: true },
    h(Text, null, textoPdf(resp)),
    h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}` }),
  );
}

export function Assinatura({ c }: { c: CabecalhoRelatorio }): ReactElement {
  const r = c.responsavel;
  return h(View, { style: est.assinatura, wrap: false },
    T(r ? r.nome : "Responsável técnico", est.negrito),
    T(r ? `${r.registro} · ART/RRT ${r.art}` : "CREA/CAU: ______________   ART/RRT: ______________", {}),
    T(c.empresa.nome, {}),
  );
}

export interface Coluna {
  titulo: string;
  largura: number;
  direita?: boolean;
}

export type EstiloLinha = "normal" | "grupo" | "subtotal" | "detalhe" | "alerta";

export interface LinhaTabela {
  celulas: readonly string[];
  estilo?: EstiloLinha;
}

const ESTILO_LINHA: Record<EstiloLinha, Style | null> = { normal: null, grupo: est.grupo, subtotal: est.subtotal, detalhe: est.detalhe, alerta: est.alerta };

function celula(col: Coluna, texto: string, extra: Style | null): ReactElement {
  const base: Style[] = [est.cel, { width: `${col.largura}%`, textAlign: col.direita ? "right" : "left" }];
  return h(Text, { style: extra ? [...base, extra] : base }, textoPdf(texto));
}

/** Tabela por linhas; a linha de títulos se repete nas páginas que a tabela ocupa. */
export function Tabela({ colunas, linhas }: { colunas: readonly Coluna[]; linhas: readonly LinhaTabela[] }): ReactElement {
  return h(View, { style: est.tabela },
    h(View, { style: [est.linha, est.titulo], fixed: true }, ...colunas.map((col) => celula(col, col.titulo, null))),
    ...linhas.map((l) => h(View, { style: est.linha, wrap: false },
      ...colunas.map((col, j) => celula(col, l.celulas[j] ?? "", ESTILO_LINHA[l.estilo ?? "normal"])))),
  );
}

export function Avisos({ avisos }: { avisos: readonly string[] }): ReactElement | null {
  if (!avisos.length) return null;
  return h(View, { style: { marginBottom: 6 } }, ...avisos.map((a) => T(`! ${a}`, est.aviso)));
}
