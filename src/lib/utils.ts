import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes do Tailwind resolvendo conflitos. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUMERO = (casas: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Formata valores (texto decimal vindo do banco/motor) para exibição. */
export function moeda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return MOEDA.format(Number(valor));
}

export function numero(valor: string | number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return NUMERO(casas).format(Number(valor));
}

/** "2026-10-01" → "10/2026" */
export function mesAno(data: string | null | undefined): string {
  if (!data) return "—";
  const [a, m] = data.split("-");
  return `${m}/${a}`;
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "object" && erro !== null && "message" in erro && typeof erro.message === "string") return erro.message;
  return "Erro inesperado.";
}
