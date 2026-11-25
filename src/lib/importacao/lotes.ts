/**
 * Lotes de importação (função pura, usada no navegador e na Route Handler).
 * A base lida das planilhas é quebrada em lotes de até 1000 linhas, na ordem
 * insumos → equipamentos → composições → itens. Cada lote tem um índice global (0, 1, 2...);
 * esse índice é o `p_lote` de `importar_itens`, o que torna o reenvio (retomada) idempotente.
 * As chaves das linhas seguem exatamente as colunas lidas pelas RPCs (`jsonb_to_recordset`).
 */
import { z } from "zod";
import { UFS } from "../engine/entrada.schema";
import type { BaseImportada } from "./parsers/tipos";
import { validacaoArmazenadaSchema } from "./validacao";

export const TAMANHO_LOTE = 1000;
export const ETAPAS_LOTE = ["insumos", "equipamentos", "composicoes", "itens"] as const;
export type EtapaLote = (typeof ETAPAS_LOTE)[number];

/** Texto decimal (aceita o expoente que o parser pode gerar, ex.: "1e-7"). */
export const decimalTexto = z.string().trim().regex(/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i, "Número inválido.");
const decimalOuNull = decimalTexto.nullable();
const codigo = z.string().trim().min(1).max(40);
const textoCurto = (max: number) => z.string().max(max);

export const linhaInsumoSchema = z.object({
  codigo,
  descricao: textoCurto(2000),
  unidade: textoCurto(40),
  tipo: z.enum(["MATERIAL", "MAO_OBRA", "EQUIPAMENTO", "SERVICO", "TRANSPORTE"]),
  classificacao: textoCurto(200),
  preco: decimalOuNull,
  origem_preco: textoCurto(100).nullable(),
}).strict();

export const linhaEquipamentoSchema = z.object({
  codigo,
  chp: decimalTexto,
  chi: decimalTexto,
  depreciacao: decimalOuNull,
  juros: decimalOuNull,
  manutencao: decimalOuNull,
  materiais_operacao: decimalOuNull,
  mao_obra_operacao: decimalOuNull,
}).strict();

export const linhaComposicaoSchema = z.object({
  codigo,
  descricao: textoCurto(2000),
  unidade: textoCurto(40),
  grupo: textoCurto(300).nullable(),
  preco_publicado: decimalOuNull,
  producao_equipe: decimalOuNull,
  fic: decimalOuNull,
  fit: decimalOuNull,
}).strict();

export const linhaItemSchema = z.object({
  composicao_codigo: codigo,
  tipo_item: z.enum(["INSUMO", "COMPOSICAO"]),
  item_codigo: codigo,
  coeficiente: decimalTexto,
  utilizacao_operativa: decimalOuNull,
  utilizacao_improdutiva: decimalOuNull,
  grupo_sicro: z.enum(["A", "B", "C", "D", "E", "F"]).nullable(),
  extra: z.record(z.string().max(40), z.string().max(300)).nullable(),
}).strict();

export type LinhaInsumo = z.infer<typeof linhaInsumoSchema>;
export type LinhaEquipamento = z.infer<typeof linhaEquipamentoSchema>;
export type LinhaComposicao = z.infer<typeof linhaComposicaoSchema>;
export type LinhaItem = z.infer<typeof linhaItemSchema>;

const indice = z.number().int().min(0).max(100_000);
const linhas = <T extends z.ZodType>(s: T) => z.array(s).min(1).max(TAMANHO_LOTE);

export const loteSchema = z.discriminatedUnion("etapa", [
  z.object({ etapa: z.literal("insumos"), indice, linhas: linhas(linhaInsumoSchema) }),
  z.object({ etapa: z.literal("equipamentos"), indice, linhas: linhas(linhaEquipamentoSchema) }),
  z.object({ etapa: z.literal("composicoes"), indice, linhas: linhas(linhaComposicaoSchema) }),
  z.object({ etapa: z.literal("itens"), indice, linhas: linhas(linhaItemSchema) }),
]);
export type Lote = z.infer<typeof loteSchema>;

// Chaves e caminhos ------------------------------------------------------------------------------

export const fonteSchema = z.enum(["SINAPI", "SICRO"]);
export const ufSchema = z.enum(UFS);
export const mesAnoSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "Mês-base inválido (AAAA-MM-01).");
export const hashSchema = z.string().regex(/^[0-9a-f]{64}$/, "Hash SHA-256 inválido.");

/**
 * Chave de deduplicação gravada em `bases_referencia.arquivo_hash`. Um mesmo arquivo oficial do
 * SINAPI traz todas as UFs, com e sem desoneração; por isso a chave junta o SHA-256 com a UF e a
 * variante. Reenviar o mesmo arquivo para a mesma base é recusado (ou retomado, se incompleto).
 */
export function chaveImportacao(hash: string, uf: string, desonerado: boolean): string {
  return `${hash}:${uf}:${desonerado ? "D" : "N"}`;
}

/** "SINAPI/PI/2026-10" */
export function pastaArquivos(fonte: string, uf: string, mesAno: string): string {
  return `${fonte}/${uf}/${mesAno.slice(0, 7)}`;
}

/** Nome seguro para a chave do Storage (sem acentos nem caracteres especiais). */
export function nomeSeguro(nome: string): string {
  const limpo = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_");
  return limpo.replace(/^_+|_+$/g, "").slice(-120) || "arquivo";
}

/** `<fonte>/<uf>/<AAAA-MM>/<hash>-<arquivo>` */
export function caminhoArquivo(fonte: string, uf: string, mesAno: string, hash: string, nome: string): string {
  return `${pastaArquivos(fonte, uf, mesAno)}/${hash}-${nomeSeguro(nome)}`;
}

// Envelope da Route Handler ----------------------------------------------------------------------

const identificacao = { fonte: fonteSchema, uf: ufSchema, mesAno: mesAnoSchema, desonerado: z.boolean(), hash: hashSchema };

export const requisicaoImportacaoSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("iniciar"),
    ...identificacao,
    layout: z.string().trim().min(1).max(100),
    arquivos: z.array(z.string().min(1).max(400)).min(1).max(50),
    avisos: z.array(z.string().max(1000)).max(500),
    totalLotes: z.number().int().min(1).max(100_000),
  }),
  z.object({ acao: z.literal("estado"), ...identificacao }),
  z.object({ acao: z.literal("lote"), importacaoId: z.string().uuid(), lote: loteSchema }),
  z.object({
    acao: z.literal("finalizar"),
    importacaoId: z.string().uuid(),
    encargos: z.object({ horistaPct: decimalOuNull, mensalistaPct: decimalOuNull }),
    validacao: validacaoArmazenadaSchema,
  }),
  z.object({ acao: z.literal("cancelar"), importacaoId: z.string().uuid() }),
]);
export type RequisicaoImportacao = z.infer<typeof requisicaoImportacaoSchema>;

export type SituacaoImportacao = "nova" | "em_andamento" | "concluida" | "conflito";

export interface EstadoImportacao {
  situacao: SituacaoImportacao;
  baseId: string | null;
  importacaoId: string | null;
  /** quantidade de lotes já gravados = índice do próximo lote */
  loteAtual: number;
  totalLotes: number;
  etapa: string | null;
}

export interface RespostaImportacao<T = unknown> {
  ok: boolean;
  dados?: T;
  erro?: string;
}

// Montagem dos lotes -----------------------------------------------------------------------------

function fatiar<T>(lista: readonly T[], tamanho: number): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho));
  return partes;
}

function linhasDaEtapa(base: BaseImportada, etapa: EtapaLote): LinhaInsumo[] | LinhaEquipamento[] | LinhaComposicao[] | LinhaItem[] {
  switch (etapa) {
    case "insumos":
      return base.insumos.map((i) => ({
        codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, tipo: i.tipo,
        classificacao: i.classificacao, preco: i.preco, origem_preco: i.origemPreco,
      }));
    case "equipamentos":
      return base.equipamentos.map((e) => ({
        codigo: e.codigo, chp: e.chp, chi: e.chi, depreciacao: e.depreciacao, juros: e.juros,
        manutencao: e.manutencao, materiais_operacao: e.materiaisOperacao, mao_obra_operacao: e.maoObraOperacao,
      }));
    case "composicoes":
      return base.composicoes.map((c) => ({
        codigo: c.codigo, descricao: c.descricao, unidade: c.unidade, grupo: c.grupo,
        preco_publicado: c.precoPublicado, producao_equipe: c.producaoEquipe, fic: c.fic, fit: c.fit,
      }));
    case "itens":
      return base.itens.map((it) => ({
        composicao_codigo: it.composicaoCodigo, tipo_item: it.tipoItem, item_codigo: it.itemCodigo,
        coeficiente: it.coeficiente, utilizacao_operativa: it.utilizacaoOperativa,
        utilizacao_improdutiva: it.utilizacaoImprodutiva, grupo_sicro: it.grupoSicro, extra: it.extra,
      }));
  }
}

/** Lotes ordenados (insumos → equipamentos → composições → itens), índices globais 0..n-1. */
export function montarLotes(base: BaseImportada, tamanho = TAMANHO_LOTE): Lote[] {
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > TAMANHO_LOTE) {
    throw new Error(`Tamanho de lote inválido (1 a ${TAMANHO_LOTE}).`);
  }
  const lotes: Lote[] = [];
  for (const etapa of ETAPAS_LOTE) {
    for (const parte of fatiar<unknown>(linhasDaEtapa(base, etapa), tamanho)) {
      lotes.push({ etapa, indice: lotes.length, linhas: parte } as Lote);
    }
  }
  return lotes;
}

/** Quantidade de lotes por etapa (para a barra de progresso). */
export function contarLotesPorEtapa(lotes: readonly Lote[]): Record<EtapaLote, number> {
  const contagem: Record<EtapaLote, number> = { insumos: 0, equipamentos: 0, composicoes: 0, itens: 0 };
  for (const l of lotes) contagem[l.etapa] += 1;
  return contagem;
}

export const ordemEtapa = (etapa: string): number => ETAPAS_LOTE.indexOf(etapa as EtapaLote);
