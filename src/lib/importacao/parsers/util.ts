import type { Celula } from "../xlsx-leitor";

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;
export type UF = (typeof UFS)[number];

const ESTADOS: Record<string, UF> = {
  acre: "AC", alagoas: "AL", amazonas: "AM", amapa: "AP", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "minas gerais": "MG", "mato grosso do sul": "MS", "mato grosso": "MT", para: "PA",
  paraiba: "PB", pernambuco: "PE", piaui: "PI", parana: "PR", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", rondonia: "RO", roraima: "RR", "rio grande do sul": "RS",
  "santa catarina": "SC", sergipe: "SE", "sao paulo": "SP", tocantins: "TO",
};

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7,
  agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export function normalizar(valor: Celula | undefined): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function texto(valor: Celula | undefined): string {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

/** Converte célula numérica (ou texto "1.234,56") em texto decimal; "-" e vazio viram null. */
export function numeroTexto(valor: Celula | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : null;
  const s = valor.trim();
  if (s === "" || s === "-") return null;
  const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(limpo) ? String(Number(limpo)) : null;
}

export function codigoTexto(valor: Celula | undefined): string {
  if (typeof valor === "number") return String(Math.trunc(valor));
  return texto(valor);
}

export interface Cabecalho {
  linha: number;
  colunas: Map<string, number>;
}

/**
 * Procura a linha de cabeçalho que contém todos os nomes obrigatórios (comparação sem acento,
 * por prefixo). Retorna o índice de cada coluna pela chave pedida.
 */
export function localizarCabecalho(
  linhas: Celula[][],
  obrigatorios: Record<string, string>,
  maxBusca = 40,
): Cabecalho | null {
  const limite = Math.min(maxBusca, linhas.length);
  for (let i = 0; i < limite; i++) {
    const celulas = (linhas[i] ?? []).map(normalizar);
    const colunas = new Map<string, number>();
    for (const [chave, nome] of Object.entries(obrigatorios)) {
      const alvo = normalizar(nome);
      const idx = celulas.findIndex((c) => c === alvo || c.startsWith(alvo));
      if (idx >= 0) colunas.set(chave, idx);
    }
    if (colunas.size === Object.keys(obrigatorios).length) return { linha: i, colunas };
  }
  return null;
}

/** Primeiras linhas não vazias, para mostrar ao usuário quando o layout é desconhecido. */
export function amostraCabecalhos(linhas: Celula[][], max = 12): string[][] {
  return linhas
    .slice(0, 40)
    .map((l) => l.filter((c) => c !== null && c !== "").map((c) => texto(c).slice(0, 60)))
    .filter((l) => l.length > 0)
    .slice(0, max);
}

/** "10/2026" → "2026-10-01"; "Julho/2026" → "2026-07-01". */
export function mesAnoParaData(valor: Celula | undefined): string | null {
  const s = normalizar(valor);
  const num = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (num) return `${num[2]}-${String(Number(num[1])).padStart(2, "0")}-01`;
  const ext = /^([a-z]+)\/(\d{4})$/.exec(s);
  const mes = ext ? MESES[ext[1] ?? ""] : undefined;
  if (ext && mes) return `${ext[2]}-${String(mes).padStart(2, "0")}-01`;
  return null;
}

export function estadoParaUf(nome: Celula | undefined): UF | null {
  return ESTADOS[normalizar(nome)] ?? null;
}

export function ehUf(valor: string): valor is UF {
  return (UFS as readonly string[]).includes(valor);
}
