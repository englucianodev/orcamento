/**
 * Validação de números decimais digitados nas telas de Configurações (sempre como texto, sem float)
 * e conversões percentual ↔ fração com decimal.js. Usado no navegador e no servidor.
 */
import { z } from "zod";
import { D } from "@/lib/engine/decimal";

const PADRAO_DECIMAL = /^-?\d+(\.\d+)?$/;

/** "1.234,56" → "1234.56"; "1,5" → "1.5"; "  2 " → "2". Não valida, só normaliza. */
export function normalizarDecimal(valor: unknown): string {
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor !== "string") return "";
  const t = valor.trim().replace(/\s/g, "");
  if (t.includes(",")) return t.replace(/\./g, "").replace(",", ".");
  return t;
}

/** Remove zeros à direita sem notação exponencial: "6.6500" → "6.65", "2.000" → "2". */
export function limparZeros(texto: string): string {
  if (!texto.includes(".")) return texto;
  return texto.replace(/0+$/, "").replace(/\.$/, "");
}

interface OpcoesDecimal {
  rotulo: string;
  minimo?: string;
  /** mínimo exclusivo (valor tem de ser maior) */
  maiorQue?: string;
  maximo?: string;
  /** máximo exclusivo (valor tem de ser menor) */
  menorQue?: string;
  casas?: number;
}

/** Schema Zod de decimal em texto (aceita vírgula), devolvendo o texto normalizado com ponto. */
export function decimalTexto(o: OpcoesDecimal) {
  return z.preprocess(
    normalizarDecimal,
    z.string()
      .min(1, `Informe ${o.rotulo}.`)
      .regex(PADRAO_DECIMAL, `${capitalizar(o.rotulo)}: use um número (ex.: 1,25).`)
      .superRefine((v, ctx) => {
        if (!PADRAO_DECIMAL.test(v)) return; // já reportado pelo regex
        const d = new D(v);
        const erro = (mensagem: string) => ctx.addIssue({ code: "custom", message: mensagem });
        if (o.minimo !== undefined && d.lt(o.minimo)) erro(`${capitalizar(o.rotulo)} deve ser no mínimo ${br(o.minimo)}.`);
        if (o.maiorQue !== undefined && d.lte(o.maiorQue)) erro(`${capitalizar(o.rotulo)} deve ser maior que ${br(o.maiorQue)}.`);
        if (o.maximo !== undefined && d.gt(o.maximo)) erro(`${capitalizar(o.rotulo)} deve ser no máximo ${br(o.maximo)}.`);
        if (o.menorQue !== undefined && d.gte(o.menorQue)) erro(`${capitalizar(o.rotulo)} deve ser menor que ${br(o.menorQue)}.`);
        if (o.casas !== undefined && d.decimalPlaces() > o.casas) erro(`${capitalizar(o.rotulo)}: no máximo ${o.casas} casas decimais.`);
      })
      .transform((v) => (PADRAO_DECIMAL.test(v) ? limparZeros(new D(v).toFixed()) : v)),
  );
}

/** Percentual (texto) → fração (texto): "6,65" → "0.0665". */
export function percentualParaFracao(percentual: string): string {
  return limparZeros(new D(normalizarDecimal(percentual)).div(100).toFixed());
}

/** Fração (texto/número do banco) → percentual (texto): "0.0665" → "6.65". */
export function fracaoParaPercentual(fracao: string | number): string {
  return limparZeros(new D(fracao).times(100).toFixed());
}

/** Exibição pt-BR de um decimal em texto, sem perder casas: "1234.5" → "1.234,5". */
export function br(texto: string | number | null | undefined): string {
  if (texto === null || texto === undefined || texto === "") return "—";
  const [int = "0", frac] = limparZeros(new D(texto).toFixed()).split(".");
  const neg = int.startsWith("-");
  const digitos = int.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${digitos}${frac ? `,${frac}` : ""}`;
}

/** Valor do banco/semente pronto para o campo de edição (vírgula decimal). */
export const paraCampo = (texto: string | number | null | undefined): string =>
  texto === null || texto === undefined || texto === "" ? "" : limparZeros(new D(texto).toFixed()).replace(".", ",");

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface ErroBanco { code?: string; message: string }

/** Mensagem amigável para erros do Supabase/PostgREST. */
export function mensagemBanco(erro: ErroBanco, acao: string): string {
  if (erro.code === "23505") return `Não foi possível ${acao}: já existe um registro igual.`;
  if (erro.code === "42501" || /row-level security/i.test(erro.message)) {
    return `Não foi possível ${acao}: você não tem permissão para alterar as configurações desta empresa.`;
  }
  if (erro.code === "23514") return `Não foi possível ${acao}: algum valor está fora do permitido.`;
  return `Não foi possível ${acao}. Tente novamente. (${erro.message})`;
}
