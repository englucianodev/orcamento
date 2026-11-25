"use server";
import { revalidatePath } from "next/cache";
import { mensagemBanco } from "@/components/configuracoes/decimais";
import { caminhoLogoValido } from "@/components/configuracoes/esquemas";
import type { EstadoAcao } from "@/components/configuracoes/tipos";
import { contextoEdicao } from "../contexto";

const BUCKET = "logos";

/** Grava em empresas.logo_path o arquivo já enviado pelo navegador; apaga a versão com outra extensão. */
export async function registrarLogo(caminho: unknown): Promise<EstadoAcao> {
  const ctx = await contextoEdicao(true);
  if ("erro" in ctx) return { erro: ctx.erro };
  if (typeof caminho !== "string" || !caminhoLogoValido(ctx.empresaId, caminho)) return { erro: "Caminho do logo inválido." };

  const nome = caminho.slice(ctx.empresaId.length + 1);
  const { data: arquivos, error: erroLista } = await ctx.supabase.storage.from(BUCKET).list(ctx.empresaId, { search: nome });
  if (erroLista) return { erro: mensagemBanco(erroLista, "conferir o arquivo enviado") };
  if (!arquivos?.some((a) => a.name === nome)) return { erro: "O arquivo do logo não foi encontrado. Envie novamente." };

  const { data: empresa, error: erroLeitura } = await ctx.supabase.from("empresas").select("logo_path").eq("id", ctx.empresaId).single();
  if (erroLeitura) return { erro: mensagemBanco(erroLeitura, "ler o logo atual") };
  const { error } = await ctx.supabase.from("empresas").update({ logo_path: caminho }).eq("id", ctx.empresaId);
  if (error) return { erro: mensagemBanco(error, "salvar o logo") };

  const anterior = (empresa as { logo_path: string | null }).logo_path;
  let aviso = "";
  if (anterior && anterior !== caminho && caminhoLogoValido(ctx.empresaId, anterior)) {
    const { error: erroRemocao } = await ctx.supabase.storage.from(BUCKET).remove([anterior]);
    if (erroRemocao) aviso = " (o arquivo anterior não pôde ser apagado)";
  }
  revalidatePath("/configuracoes", "layout");
  return { ok: `Logo atualizado${aviso}.` };
}

export async function removerLogo(): Promise<EstadoAcao> {
  const ctx = await contextoEdicao(true);
  if ("erro" in ctx) return { erro: ctx.erro };
  const { data: empresa, error: erroLeitura } = await ctx.supabase.from("empresas").select("logo_path").eq("id", ctx.empresaId).single();
  if (erroLeitura) return { erro: mensagemBanco(erroLeitura, "ler o logo atual") };
  const atual = (empresa as { logo_path: string | null }).logo_path;
  if (atual && caminhoLogoValido(ctx.empresaId, atual)) {
    const { error: erroRemocao } = await ctx.supabase.storage.from(BUCKET).remove([atual]);
    if (erroRemocao) return { erro: mensagemBanco(erroRemocao, "apagar o arquivo do logo") };
  }
  const { error } = await ctx.supabase.from("empresas").update({ logo_path: null }).eq("id", ctx.empresaId);
  if (error) return { erro: mensagemBanco(error, "remover o logo") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Logo removido." };
}
