"use server";
import { revalidatePath } from "next/cache";
import { mensagemBanco } from "@/components/configuracoes/decimais";
import { ehChaveTabela, validarTabela } from "@/components/configuracoes/tabelas-esquemas";
import type { EstadoAcao } from "@/components/configuracoes/tipos";
import { contextoEdicao } from "../contexto";

const TAMANHO_MAXIMO_JSON = 20_000;

export async function salvarTabela(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const chave = form.get("chave");
  const texto = form.get("config");
  if (typeof chave !== "string" || !ehChaveTabela(chave)) return { erro: "Tabela desconhecida." };
  if (typeof texto !== "string" || texto.length > TAMANHO_MAXIMO_JSON) return { erro: "Conteúdo da tabela inválido ou muito grande." };
  const r = validarTabela(chave, texto);
  if (!r.ok) return { erro: r.erro };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("tabelas_parametricas").upsert(
    { empresa_id: ctx.empresaId, chave, config: r.valor },
    { onConflict: "empresa_id,chave" },
  );
  if (error) return { erro: mensagemBanco(error, "salvar a tabela") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Tabela salva para a empresa." };
}

export async function restaurarTabela(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const chave = form.get("chave");
  if (typeof chave !== "string" || !ehChaveTabela(chave)) return { erro: "Tabela desconhecida." };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("tabelas_parametricas").delete().eq("empresa_id", ctx.empresaId).eq("chave", chave);
  if (error) return { erro: mensagemBanco(error, "restaurar a tabela") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Restaurada a tabela global." };
}
