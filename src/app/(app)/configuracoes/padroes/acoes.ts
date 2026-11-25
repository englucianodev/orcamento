"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensagemBanco } from "@/components/configuracoes/decimais";
import { configPadraoDoFormulario, configPadraoSchema, primeiroErro } from "@/components/configuracoes/esquemas";
import type { EstadoAcao } from "@/components/configuracoes/tipos";
import { PADROES } from "@/lib/engine/entrada.schema";
import { contextoEdicao } from "../contexto";

const padraoSchema = z.enum(PADROES, { message: "Padrão inválido." });

export async function salvarPadrao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const padrao = padraoSchema.safeParse(form.get("padrao"));
  if (!padrao.success) return { erro: primeiroErro(padrao.error) };
  const config = configPadraoSchema.safeParse(configPadraoDoFormulario(form));
  if (!config.success) return { erro: primeiroErro(config.error) };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("padroes_acabamento").upsert(
    { empresa_id: ctx.empresaId, padrao: padrao.data, config: config.data },
    { onConflict: "empresa_id,padrao" },
  );
  if (error) return { erro: mensagemBanco(error, "salvar o padrão") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Padrão salvo para a empresa." };
}

export async function restaurarPadrao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const padrao = padraoSchema.safeParse(form.get("padrao"));
  if (!padrao.success) return { erro: primeiroErro(padrao.error) };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("padroes_acabamento").delete()
    .eq("empresa_id", ctx.empresaId).eq("padrao", padrao.data);
  if (error) return { erro: mensagemBanco(error, "restaurar o padrão") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Restaurado o padrão global." };
}
