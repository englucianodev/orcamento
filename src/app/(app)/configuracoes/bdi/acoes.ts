"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensagemBanco } from "@/components/configuracoes/decimais";
import { bdiParaBanco, bdiSchema, primeiroErro } from "@/components/configuracoes/esquemas";
import type { EstadoAcao } from "@/components/configuracoes/tipos";
import { calcularBdi } from "@/lib/engine/bdi";
import { contextoEdicao } from "../contexto";

/** Cria ou altera um BDI da empresa. Recebe os percentuais do formulário (react-hook-form). */
export async function salvarBdi(entrada: unknown): Promise<EstadoAcao> {
  const dados = bdiSchema.safeParse(entrada);
  if (!dados.success) return { erro: primeiroErro(dados.error) };
  const linha = bdiParaBanco(dados.data);
  try {
    calcularBdi(linha);
  } catch {
    return { erro: "Tributos (I) devem ser menores que 100%." };
  }
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const consulta = dados.data.id
    ? ctx.supabase.from("bdi_config").update(linha).eq("id", dados.data.id).eq("empresa_id", ctx.empresaId).select("id")
    : ctx.supabase.from("bdi_config").insert({ ...linha, empresa_id: ctx.empresaId }).select("id");
  const { data, error } = await consulta;
  if (error) return { erro: mensagemBanco(error, "salvar o BDI") };
  if (!data?.length) return { erro: "BDI não encontrado nesta empresa (pode ter sido excluído)." };
  revalidatePath("/configuracoes", "layout");
  return { ok: dados.data.id ? "BDI atualizado." : "BDI criado." };
}

export async function excluirBdi(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "BDI inválido." };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("bdi_config").delete().eq("id", id.data).eq("empresa_id", ctx.empresaId);
  if (error) return { erro: mensagemBanco(error, "excluir o BDI") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "BDI excluído." };
}
