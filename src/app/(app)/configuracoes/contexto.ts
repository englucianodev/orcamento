import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirEmpresa, podeEditar, type Papel } from "@/lib/empresa";

export interface ContextoEdicao {
  supabase: SupabaseClient;
  empresaId: string;
  papel: Papel;
}

/**
 * Contexto para server actions: exige empresa selecionada e papel com permissão de edição
 * (ou administrador, quando `apenasAdmin`). A RLS do banco aplica a mesma regra.
 */
export async function contextoEdicao(apenasAdmin = false): Promise<ContextoEdicao | { erro: string }> {
  const { supabase, atual } = await exigirEmpresa();
  if (apenasAdmin ? atual.papel !== "admin" : !podeEditar(atual.papel)) {
    return {
      erro: apenasAdmin
        ? "Somente administradores da empresa podem fazer esta alteração."
        : "Seu acesso é somente leitura: peça a um administrador para alterar as configurações.",
    };
  }
  return { supabase, empresaId: atual.id, papel: atual.papel };
}

export type ContextoPagina = Awaited<ReturnType<typeof exigirEmpresa>> & { editor: boolean; admin: boolean };

/** Contexto para as páginas: empresa atual e se o usuário pode editar. */
export async function contextoPagina(): Promise<ContextoPagina> {
  const ctx = await exigirEmpresa();
  return { ...ctx, editor: podeEditar(ctx.atual.papel), admin: ctx.atual.papel === "admin" };
}
