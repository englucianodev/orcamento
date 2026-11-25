/**
 * Motor de quantitativos (seção 7): entrada validada → lista de
 * { etapa, chaveServico, ambienteId?, quantidade, unidade, memoria }.
 */
import { ETAPAS } from "../catalogo";
import { entradaSchema, type Entrada } from "../entrada.schema";
import { geometriaObra } from "../geometria";
import { criarIndices } from "../indices";
import { PADROES_ACABAMENTO } from "../padroes";
import { TABELAS_PADRAO } from "../tabelas";
import { alvenaria } from "./alvenaria";
import { cobertura } from "./cobertura";
import { eletrica } from "./eletrica";
import { esquadrias, pintura } from "./esquadrias";
import { administracao, areaGourmet, areasExternas, sistemasEspeciais } from "./externas";
import { estrutura, fundacao } from "./fundacao";
import { hidrossanitaria, loucasMetais } from "./hidrossanitaria";
import { piscina } from "./piscina";
import { preliminares, terraplenagem } from "./preliminares";
import { forro, impermeabilizacao, revestimentos } from "./revestimentos";
import type { ConfigMotor, Contexto, EtapaQuantitativos, ItemQuantitativo } from "./tipos";

export type { ConfigMotor, ItemQuantitativo } from "./tipos";

const ETAPAS_MOTOR: readonly EtapaQuantitativos[] = [
  preliminares, terraplenagem, fundacao, estrutura, alvenaria, cobertura, revestimentos, forro,
  impermeabilizacao, esquadrias, eletrica, hidrossanitaria, loucasMetais, pintura, piscina, areaGourmet,
  areasExternas, sistemasEspeciais, administracao,
];

const ORDEM_ETAPA = new Map<string, number>(ETAPAS.map((e, i) => [e.id, i]));

export function configPadrao(): ConfigMotor {
  return { indices: criarIndices(), padroes: PADROES_ACABAMENTO, tabelas: TABELAS_PADRAO };
}

export function criarContexto(entrada: Entrada, config: Partial<ConfigMotor> = {}): Contexto {
  const c = { ...configPadrao(), ...config };
  const e = entradaSchema.parse(entrada);
  return {
    entrada: e, idx: c.indices, padrao: c.padroes[e.dadosGerais.padrao], tabelas: c.tabelas,
    geo: geometriaObra(e, c.indices),
  };
}

export function gerarQuantitativos(entrada: Entrada, config: Partial<ConfigMotor> = {}): ItemQuantitativo[] {
  const ctx = criarContexto(entrada, config);
  const itens = ETAPAS_MOTOR.flatMap((etapa) => etapa(ctx));
  // ordem estável: etapa do catálogo, depois a ordem de emissão
  return itens
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (ORDEM_ETAPA.get(a.it.etapa)! - ORDEM_ETAPA.get(b.it.etapa)!) || a.i - b.i)
    .map(({ it }) => it);
}
