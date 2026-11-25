import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exigirUsuario } from "./supabase/servidor";

export type Papel = "admin" | "orcamentista" | "leitor";
export interface EmpresaDoUsuario {
  id: string;
  nome: string;
  papel: Papel;
}

export const COOKIE_EMPRESA = "empresa_atual";

export interface ContextoEmpresa {
  supabase: SupabaseClient;
  usuario: User;
  empresas: EmpresaDoUsuario[];
  atual: EmpresaDoUsuario | null;
  adminPlataforma: boolean;
}

interface LinhaMembro {
  papel: Papel;
  empresas: { id: string; nome: string } | null;
}

/** Usuário, empresas de que participa e a empresa selecionada (cookie) — tudo filtrado pela RLS. */
export async function contextoEmpresa(): Promise<ContextoEmpresa> {
  const { supabase, usuario } = await exigirUsuario();
  const [{ data: membros, error }, { data: admin }] = await Promise.all([
    supabase.from("membros").select("papel, empresas(id, nome)").eq("user_id", usuario.id),
    supabase.from("admins_plataforma").select("user_id").eq("user_id", usuario.id).maybeSingle(),
  ]);
  if (error) throw new Error(`Falha ao carregar empresas: ${error.message}`);
  const empresas = ((membros ?? []) as unknown as LinhaMembro[])
    .filter((m) => m.empresas)
    .map((m) => ({ id: m.empresas!.id, nome: m.empresas!.nome, papel: m.papel }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const escolhida = (await cookies()).get(COOKIE_EMPRESA)?.value;
  const atual = empresas.find((e) => e.id === escolhida) ?? empresas[0] ?? null;
  return { supabase, usuario, empresas, atual, adminPlataforma: Boolean(admin) };
}

/** Exige uma empresa selecionada (senão leva ao cadastro da empresa). */
export async function exigirEmpresa(): Promise<ContextoEmpresa & { atual: EmpresaDoUsuario }> {
  const ctx = await contextoEmpresa();
  if (!ctx.atual) redirect("/empresa");
  return ctx as ContextoEmpresa & { atual: EmpresaDoUsuario };
}

export const podeEditar = (p: Papel): boolean => p === "admin" || p === "orcamentista";

export async function exigirAdminPlataforma(): Promise<ContextoEmpresa> {
  const ctx = await contextoEmpresa();
  if (!ctx.adminPlataforma) redirect("/painel");
  return ctx;
}
