/**
 * Validação obrigatória da importação (seção 5): recalcula cada composição com o motor de preços
 * e compara com o preço publicado. Divergências acima de R$ 0,01 são listadas.
 * Função pura: roda no Web Worker e nos testes.
 */
import { z } from "zod";
import { D, type Dec } from "../engine/decimal";
import { criarCalculadoraSinapi } from "../engine/precos-sinapi";
import { criarCalculadoraSicro } from "../engine/precos-sicro";
import { baseParaMotorSicro, baseParaMotorSinapi } from "./para-motor";
import type { BaseImportada } from "./parsers/tipos";

export const TOLERANCIA = "0.01";
/** máximo de linhas guardadas no banco para cada lista do relatório */
export const LIMITE_LISTA_ARMAZENADA = 500;

export interface Divergencia {
  codigo: string;
  publicado: string;
  calculado: string;
  diferenca: string;
}

export interface SemCusto {
  codigo: string;
  motivo: string;
}

export interface ResultadoValidacao {
  /** composições com preço publicado e custo recalculado */
  comparadas: number;
  divergentes: Divergencia[];
  /** têm preço publicado, mas o motor não conseguiu calcular (insumo sem preço, ciclo...) */
  semCusto: SemCusto[];
  /** composições sem preço publicado (não comparáveis) */
  semPublicado: number;
}

const texto = z.string().max(500);
export const validacaoArmazenadaSchema = z.object({
  comparadas: z.number().int().min(0),
  semPublicado: z.number().int().min(0),
  totalDivergentes: z.number().int().min(0),
  totalSemCusto: z.number().int().min(0),
  divergentes: z.array(z.object({ codigo: texto, publicado: texto, calculado: texto, diferenca: texto }))
    .max(LIMITE_LISTA_ARMAZENADA),
  semCusto: z.array(z.object({ codigo: texto, motivo: texto })).max(LIMITE_LISTA_ARMAZENADA),
});
export type ValidacaoArmazenada = z.infer<typeof validacaoArmazenadaSchema>;

type Custeio = (codigo: string) => { custo: Dec | null; faltantes: string[] };

function custeioDaBase(base: BaseImportada): Custeio {
  if (base.fonte === "SINAPI") {
    const calc = criarCalculadoraSinapi(baseParaMotorSinapi(base));
    return (codigo) => ({ custo: calc.custo(codigo), faltantes: calc.faltantes(codigo) });
  }
  const calc = criarCalculadoraSicro(baseParaMotorSicro(base));
  return (codigo) => ({ custo: calc.custo(codigo), faltantes: calc.faltantes(codigo) });
}

function motivoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "erro no cálculo";
}

export function validarRecalculo(base: BaseImportada): ResultadoValidacao {
  const custear = custeioDaBase(base);
  const tolerancia = new D(TOLERANCIA);
  const divergentes: Divergencia[] = [];
  const semCusto: SemCusto[] = [];
  let comparadas = 0;
  let semPublicado = 0;

  for (const c of base.composicoes) {
    if (c.precoPublicado === null) {
      semPublicado += 1;
      continue;
    }
    let r: ReturnType<Custeio>;
    try {
      r = custear(c.codigo);
    } catch (erro) {
      semCusto.push({ codigo: c.codigo, motivo: motivoDoErro(erro) });
      continue;
    }
    if (r.custo === null) {
      semCusto.push({ codigo: c.codigo, motivo: r.faltantes.slice(0, 3).join("; ") || "sem custo" });
      continue;
    }
    comparadas += 1;
    const diferenca = r.custo.minus(c.precoPublicado);
    if (diferenca.abs().gt(tolerancia)) {
      divergentes.push({
        codigo: c.codigo, publicado: c.precoPublicado, calculado: r.custo.toFixed(), diferenca: diferenca.toFixed(),
      });
    }
  }
  return { comparadas, divergentes, semCusto, semPublicado };
}

/** Resumo para gravar em `bases_referencia.validacao` (listas limitadas). */
export function validacaoParaArmazenar(v: ResultadoValidacao): ValidacaoArmazenada {
  return {
    comparadas: v.comparadas,
    semPublicado: v.semPublicado,
    totalDivergentes: v.divergentes.length,
    totalSemCusto: v.semCusto.length,
    divergentes: v.divergentes.slice(0, LIMITE_LISTA_ARMAZENADA).map((d) => ({
      codigo: d.codigo.slice(0, 500), publicado: d.publicado.slice(0, 500),
      calculado: d.calculado.slice(0, 500), diferenca: d.diferenca.slice(0, 500),
    })),
    semCusto: v.semCusto.slice(0, LIMITE_LISTA_ARMAZENADA).map((s) => ({
      codigo: s.codigo.slice(0, 500), motivo: s.motivo.slice(0, 500),
    })),
  };
}
