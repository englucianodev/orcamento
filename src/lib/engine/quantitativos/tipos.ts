/**
 * Tipos comuns das etapas de quantitativos (seção 7): contexto de cálculo e construtor de item.
 * Cada etapa é uma função pura `(ctx) => ItemQuantitativo[]`.
 */
import { servicoDoCatalogo, type Etapa } from "../catalogo";
import { arred4, type Dec } from "../decimal";
import type { Entrada, Padrao } from "../entrada.schema";
import type { GeometriaObra } from "../geometria";
import type { Indices } from "../indices";
import type { ConfigPadrao } from "../padroes";
import type { TabelasMotor } from "../tabelas";

export interface ItemQuantitativo {
  etapa: Etapa;
  chaveServico: string;
  ambienteId: string | null;
  /** decimal com até 4 casas, em texto para não perder precisão */
  quantidade: string;
  unidade: string;
  memoria: string;
}

export interface ConfigMotor {
  indices: Indices;
  padroes: Readonly<Record<Padrao, ConfigPadrao>>;
  tabelas: TabelasMotor;
}

export interface Contexto {
  entrada: Entrada;
  idx: Indices;
  padrao: ConfigPadrao;
  tabelas: TabelasMotor;
  geo: GeometriaObra;
}

export type EtapaQuantitativos = (ctx: Contexto) => ItemQuantitativo[];

/**
 * Cria um item; etapa e unidade vêm do catálogo (garante coerência com o mapeamento).
 * Quantidade arredondada a 4 casas; zero ou negativa → nenhum item.
 */
export function item(chave: string, quantidade: Dec, memoria: string, ambienteId: string | null = null): ItemQuantitativo[] {
  const q = arred4(quantidade);
  if (q.lte(0)) return [];
  const s = servicoDoCatalogo(chave);
  return [{ etapa: s.etapa, chaveServico: chave, ambienteId, quantidade: q.toFixed(), unidade: s.unidade, memoria }];
}
