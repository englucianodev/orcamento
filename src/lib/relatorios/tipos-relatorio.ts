/** Tipos de relatório (seção 11): usados pelas rotas, pelo PDF, pelo Excel e pela lista de links. */
import { z } from "zod";

export const TIPOS_RELATORIO = [
  "proposta", "sintetica", "analitica", "memoria", "composicoes", "bdi", "abc", "cronograma", "resumo", "completo",
] as const;
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number];

export const tipoRelatorioSchema = z.enum(TIPOS_RELATORIO);

export const TITULOS_RELATORIO: Record<TipoRelatorio, string> = {
  proposta: "Proposta comercial",
  sintetica: "Planilha orçamentária sintética",
  analitica: "Planilha orçamentária analítica",
  memoria: "Memória de cálculo por ambiente",
  composicoes: "Composições analíticas",
  bdi: "BDI e encargos sociais",
  abc: "Curva ABC",
  cronograma: "Cronograma físico-financeiro",
  resumo: "Resumo por etapa e custo por m²",
  completo: "Relatório completo",
};
