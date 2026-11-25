"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { COOKIE_EMPRESA, contextoEmpresa } from "@/lib/empresa";
import { urlDoSite } from "@/lib/supabase/env";
import { exigirUsuario } from "@/lib/supabase/servidor";

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

const uuid = z.string().uuid();
const papel = z.enum(["admin", "orcamentista", "leitor"]);
const OPCOES_COOKIE = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

export async function trocarEmpresa(form: FormData): Promise<void> {
  const id = uuid.safeParse(form.get("empresa"));
  const ctx = await contextoEmpresa();
  if (id.success && ctx.empresas.some((e) => e.id === id.data)) {
    (await cookies()).set(COOKIE_EMPRESA, id.data, OPCOES_COOKIE);
  }
  redirect("/painel");
}

export async function criarEmpresa(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const dados = z.object({
    nome: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
    cnpj: z.string().trim().max(18).regex(/^[\d./-]*$/, "CNPJ inválido.").optional(),
  }).safeParse({ nome: form.get("nome"), cnpj: form.get("cnpj") ?? undefined });
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  const { supabase } = await exigirUsuario();
  const { data, error } = await supabase.rpc("criar_empresa", { p_nome: dados.data.nome, p_cnpj: dados.data.cnpj || null });
  if (error) return { erro: `Não foi possível criar a empresa: ${error.message}` };
  (await cookies()).set(COOKIE_EMPRESA, String(data), OPCOES_COOKIE);
  redirect("/painel");
}

export async function convidar(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const dados = z.object({ empresa: uuid, email: z.string().trim().toLowerCase().email("E-mail inválido."), papel })
    .safeParse({ empresa: form.get("empresa"), email: form.get("email"), papel: form.get("papel") });
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  const { supabase } = await exigirUsuario();
  // convite antigo para o mesmo e-mail é substituído (novo token)
  await supabase.from("convites").delete().eq("empresa_id", dados.data.empresa).eq("email", dados.data.email);
  const { data, error } = await supabase.from("convites")
    .insert({ empresa_id: dados.data.empresa, email: dados.data.email, papel: dados.data.papel })
    .select("token").single();
  if (error || !data) return { erro: "Só administradores da empresa podem convidar." };
  revalidatePath("/empresa");
  return { ok: `${urlDoSite()}/convite/${data.token}` };
}

export async function removerConvite(form: FormData): Promise<void> {
  const id = uuid.parse(form.get("id"));
  const { supabase } = await exigirUsuario();
  await supabase.from("convites").delete().eq("id", id);
  revalidatePath("/empresa");
}

export async function alterarPapel(form: FormData): Promise<void> {
  const d = z.object({ empresa: uuid, usuario: uuid, papel }).parse({ empresa: form.get("empresa"), usuario: form.get("usuario"), papel: form.get("papel") });
  const { supabase } = await exigirUsuario();
  const r = await supabase.from("membros").update({ papel: d.papel }).eq("empresa_id", d.empresa).eq("user_id", d.usuario).select("user_id");
  voltarComErro(r.error?.message, r.data?.length);
}

/** Erros das ações de membros voltam como código fixo (a página não exibe texto vindo da URL). */
function voltarComErro(mensagem: string | undefined, afetados: number | undefined): void {
  revalidatePath("/empresa");
  if (mensagem?.includes("pelo menos um administrador")) redirect("/empresa?erro=ultimo-admin");
  if (mensagem || !afetados) redirect("/empresa?erro=membro");
}

export async function removerMembro(form: FormData): Promise<void> {
  const d = z.object({ empresa: uuid, usuario: uuid }).parse({ empresa: form.get("empresa"), usuario: form.get("usuario") });
  const { supabase } = await exigirUsuario();
  const r = await supabase.from("membros").delete().eq("empresa_id", d.empresa).eq("user_id", d.usuario).select("user_id");
  voltarComErro(r.error?.message, r.data?.length);
}

export async function aceitarConvite(form: FormData): Promise<void> {
  const token = uuid.parse(form.get("token"));
  const { supabase } = await exigirUsuario();
  const { data, error } = await supabase.rpc("aceitar_convite", { p_token: token });
  if (error) redirect(`/convite/${token}?erro=${encodeURIComponent(error.message)}`);
  (await cookies()).set(COOKIE_EMPRESA, String(data), OPCOES_COOKIE);
  redirect("/painel");
}
