"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensagemBanco } from "@/components/configuracoes/decimais";
import { composicaoPropriaSchema, primeiroErro } from "@/components/configuracoes/esquemas";
import type { EstadoAcao } from "@/components/configuracoes/tipos";
import { D } from "@/lib/engine/decimal";
import { contextoEdicao } from "../contexto";

export async function salvarComposicao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const dados = composicaoPropriaSchema.safeParse(Object.fromEntries(form));
  if (!dados.success) return { erro: primeiroErro(dados.error) };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { id, codigo, descricao, unidade, preco } = dados.data;
  const linha = { codigo, descricao, unidade, preco_publicado: new D(preco).toFixed(4) };
  const consulta = id
    ? ctx.supabase.from("composicoes").update(linha).eq("id", id).eq("empresa_id", ctx.empresaId).is("base_id", null).select("id")
    : ctx.supabase.from("composicoes").insert({ ...linha, empresa_id: ctx.empresaId, base_id: null }).select("id");
  const { data, error } = await consulta;
  if (error) {
    if (error.code === "23505") return { erro: `Já existe uma composição própria com o código ${codigo}.` };
    return { erro: mensagemBanco(error, "salvar a composição") };
  }
  if (!data?.length) return { erro: "Composição não encontrada nesta empresa." };
  revalidatePath("/configuracoes", "layout");
  return { ok: id ? "Composição atualizada." : `Composição ${codigo} criada.` };
}

export async function excluirComposicao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const id = z.coerce.number().int().positive().safeParse(form.get("id"));
  if (!id.success) return { erro: "Composição inválida." };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("composicoes").delete()
    .eq("id", id.data).eq("empresa_id", ctx.empresaId).is("base_id", null);
  if (error) return { erro: mensagemBanco(error, "excluir a composição") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Composição excluída." };
}
