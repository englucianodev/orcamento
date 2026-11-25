/**
 * Monta a configuração do motor a partir das linhas do banco: semente global (empresa_id null)
 * sobrescrita pelos valores da empresa. Também converte BDI e faixas do banco para o motor.
 */
import { calcularBdi, type FaixaBdi, type ParametrosBdi } from "../engine/bdi";
import { D, type Dec } from "../engine/decimal";
import { PADROES, type Padrao } from "../engine/entrada.schema";
import { criarIndices } from "../engine/indices";
import { PADROES_ACABAMENTO, type ConfigPadrao } from "../engine/padroes";
import type { ConfigMotor } from "../engine/quantitativos";
import { TABELAS_PADRAO, type TabelasMotor } from "../engine/tabelas";

export interface LinhaIndice { empresa_id: string | null; chave: string; valor: string | number }
export interface LinhaPadrao { empresa_id: string | null; padrao: string; config: unknown }
export interface LinhaTabela { empresa_id: string | null; chave: string; config: unknown }

const globaisPrimeiro = <T extends { empresa_id: string | null }>(linhas: readonly T[]): T[] =>
  [...linhas].sort((a, b) => Number(a.empresa_id !== null) - Number(b.empresa_id !== null));

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function montarConfigMotor(dados: {
  indices: readonly LinhaIndice[];
  padroes: readonly LinhaPadrao[];
  tabelas: readonly LinhaTabela[];
}): ConfigMotor {
  const sobrescritas: Record<string, string> = {};
  for (const l of globaisPrimeiro(dados.indices)) sobrescritas[l.chave] = String(l.valor);

  const padroes = Object.fromEntries(PADROES.map((p) => [p, { ...PADROES_ACABAMENTO[p] }])) as Record<Padrao, ConfigPadrao>;
  for (const l of globaisPrimeiro(dados.padroes)) {
    if ((PADROES as readonly string[]).includes(l.padrao) && ehObjeto(l.config)) {
      padroes[l.padrao as Padrao] = { ...padroes[l.padrao as Padrao], ...(l.config as Partial<ConfigPadrao>) };
    }
  }

  const tabelas: Record<string, unknown> = { ...TABELAS_PADRAO };
  for (const l of globaisPrimeiro(dados.tabelas)) {
    if (!(l.chave in TABELAS_PADRAO)) continue;
    const atual = tabelas[l.chave];
    tabelas[l.chave] = ehObjeto(atual) && ehObjeto(l.config) ? { ...atual, ...l.config } : l.config;
  }
  return { indices: criarIndices(sobrescritas), padroes, tabelas: tabelas as unknown as TabelasMotor };
}

export interface LinhaBdi {
  id: string;
  nome: string;
  tipo: "servico" | "material";
  tipo_obra: string;
  ac: string | number; s: string | number; r: string | number; g: string | number;
  df: string | number; l: string | number; i: string | number;
}

export const parametrosBdi = (b: LinhaBdi): ParametrosBdi => ({ ac: String(b.ac), s: String(b.s), r: String(b.r), g: String(b.g), df: String(b.df), l: String(b.l), i: String(b.i) });

export function taxaBdi(b: LinhaBdi | null | undefined): Dec {
  return b ? calcularBdi(parametrosBdi(b)) : new D(0);
}

export interface LinhaFaixa { tipo_obra: string; componente: string; minimo: string | number; medio: string | number; maximo: string | number }

/** As faixas são gravadas em percentual (3,00 = 3%); o motor usa fração. */
export function faixasDoBanco(linhas: readonly LinhaFaixa[], tipoObra: string): FaixaBdi[] {
  return linhas.filter((l) => l.tipo_obra === tipoObra).map((l) => ({
    componente: l.componente as FaixaBdi["componente"],
    minimo: new D(l.minimo).div(100), medio: new D(l.medio).div(100), maximo: new D(l.maximo).div(100),
  }));
}
