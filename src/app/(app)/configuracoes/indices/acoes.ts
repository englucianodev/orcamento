"use server";
import { revalidatePath } from "next/cache";
import { mensagemBanco } from "@/components/configuracoes/decimais";
import { indiceSchema, primeiroErro } from "@/components/configuracoes/esquemas";
import type { EstadoAcao } from "@/components/configuracoes/tipos";
import { INDICES_PADRAO } from "@/lib/engine/indices";
import { contextoEdicao } from "../contexto";

const definicao = (chave: string) => INDICES_PADRAO.find((d) => d.chave === chave);

export async function salvarIndice(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const dados = indiceSchema.safeParse({ chave: form.get("chave"), valor: form.get("valor") });
  if (!dados.success) return { erro: primeiroErro(dados.error) };
  const def = definicao(dados.data.chave);
  if (!def) return { erro: "Índice desconhecido." };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("indices_parametricos").upsert(
    { empresa_id: ctx.empresaId, chave: def.chave, valor: dados.data.valor, unidade: def.unidade, descricao: def.descricao, origem: "empresa" },
    { onConflict: "empresa_id,chave" },
  );
  if (error) return { erro: mensagemBanco(error, "salvar o índice") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Salvo." };
}

export async function restaurarIndice(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const chave = form.get("chave");
  if (typeof chave !== "string" || !definicao(chave)) return { erro: "Índice desconhecido." };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("indices_parametricos").delete().eq("empresa_id", ctx.empresaId).eq("chave", chave);
  if (error) return { erro: mensagemBanco(error, "restaurar o índice") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Restaurado o valor global." };
}
