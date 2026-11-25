/** Consultas da tela Bases (navegador, com a sessão do usuário; a RLS libera leitura das bases oficiais). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fechamentoSchema, type Fechamento } from "@/lib/orcamento/fechamento";

export interface BaseOpcao {
  id: string;
  fonte: "SINAPI" | "SICRO";
  uf: string;
  mes_ano: string;
  desonerado: boolean;
}

export const LIMITE_COMPOSICOES = 30;
export const LIMITE_INSUMOS = 50;

export const termoSchema = z.string().trim()
  .min(2, "Digite ao menos 2 caracteres.").max(100, "Termo de busca muito longo.");
export const codigoSchema = z.string().trim().regex(/^[A-Za-z0-9._/-]{1,40}$/, "Código inválido.");
const idSchema = z.string().uuid();

/** numeric do PostgREST chega como número ou texto; mantemos como texto (só exibição). */
const numeroTexto = z.union([z.number(), z.string()]).nullable().transform((v) => (v === null ? null : String(v)));

const composicaoEncontradaSchema = z.object({
  codigo: z.string(), descricao: z.string().nullable(), unidade: z.string().nullable(), preco_publicado: numeroTexto,
});
export type ComposicaoEncontrada = z.infer<typeof composicaoEncontradaSchema>;

const insumoEncontradoSchema = z.object({
  codigo: z.string(), descricao: z.string().nullable(), unidade: z.string().nullable(),
  tipo: z.string().nullable(), preco: numeroTexto, origem_preco: z.string().nullable(),
});
export type InsumoEncontrado = z.infer<typeof insumoEncontradoSchema>;

function validarEntrada(baseId: string, termo: string): string {
  if (!idSchema.safeParse(baseId).success) throw new Error("Escolha uma base.");
  const t = termoSchema.safeParse(termo);
  if (!t.success) throw new Error(t.error.issues[0]?.message ?? "Termo inválido.");
  return t.data;
}

export async function buscarComposicoes(supabase: SupabaseClient, baseId: string, termo: string): Promise<ComposicaoEncontrada[]> {
  const t = validarEntrada(baseId, termo);
  const { data, error } = await supabase.rpc("buscar_composicoes", { p_base: baseId, p_termo: t, p_limite: LIMITE_COMPOSICOES });
  if (error) throw new Error("Falha na busca de composições. Tente outro termo.");
  const lido = z.array(composicaoEncontradaSchema).safeParse(data ?? []);
  if (!lido.success) throw new Error("Resposta inesperada da busca de composições.");
  return lido.data;
}

const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function buscarInsumos(supabase: SupabaseClient, baseId: string, termo: string): Promise<InsumoEncontrado[]> {
  const t = validarEntrada(baseId, termo);
  let consulta = supabase.from("insumos").select("codigo, descricao, unidade, tipo, preco, origem_preco").eq("base_id", baseId);
  // código (ex.: 00000370, P9824) também procura na descrição; o termo só tem letras/dígitos aqui
  consulta = /^[A-Za-z]?\d{1,12}$/.test(t)
    ? consulta.or(`codigo.eq.${t},descricao.ilike.%${t}%`)
    : consulta.ilike("descricao", `%${escaparLike(t)}%`);
  const { data, error } = await consulta.order("codigo").limit(LIMITE_INSUMOS);
  if (error) throw new Error("Falha na busca de insumos.");
  const lido = z.array(insumoEncontradoSchema).safeParse(data ?? []);
  if (!lido.success) throw new Error("Resposta inesperada da busca de insumos.");
  return lido.data;
}

/** Composição + auxiliares + insumos (recursivo) pela RPC `fechamento_composicoes`. */
export async function carregarFechamento(supabase: SupabaseClient, baseId: string, codigo: string): Promise<Fechamento> {
  if (!idSchema.safeParse(baseId).success) throw new Error("Base inválida.");
  const c = codigoSchema.safeParse(codigo);
  if (!c.success) throw new Error("Código de composição inválido.");
  const { data, error } = await supabase.rpc("fechamento_composicoes", { p_base: baseId, p_codigos: [c.data] });
  if (error) throw new Error("Falha ao carregar a composição.");
  const lido = fechamentoSchema.safeParse(data);
  if (!lido.success) throw new Error("Resposta inesperada ao abrir a composição.");
  return lido.data;
}
