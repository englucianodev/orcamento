"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { urlDoSite } from "@/lib/supabase/env";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export interface EstadoAuth {
  erro?: string;
  aviso?: string;
}

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.");
const senha = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(72);

/** Só aceita caminhos internos para evitar redirecionamento aberto. */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const v = typeof valor === "string" ? valor : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/painel";
}

export async function entrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const dados = z.object({ email, senha: z.string().min(1, "Informe a senha.") }).safeParse({
    email: form.get("email"), senha: form.get("senha"),
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: dados.data.email, password: dados.data.senha });
  if (error) return { erro: "E-mail ou senha incorretos." };
  redirect(destinoSeguro(form.get("voltar")));
}

export async function enviarLinkMagico(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const dados = email.safeParse(form.get("email"));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  const supabase = await criarClienteServidor();
  const voltar = destinoSeguro(form.get("voltar"));
  const { error } = await supabase.auth.signInWithOtp({
    email: dados.data,
    options: { emailRedirectTo: `${urlDoSite()}/auth/callback?voltar=${encodeURIComponent(voltar)}`, shouldCreateUser: false },
  });
  if (error) return { erro: "Não foi possível enviar o link. Confira o e-mail ou crie uma conta." };
  return { aviso: "Enviamos um link de acesso para o seu e-mail." };
}

export async function cadastrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const dados = z.object({ nome: z.string().trim().min(2, "Informe seu nome.").max(120), email, senha }).safeParse({
    nome: form.get("nome"), email: form.get("email"), senha: form.get("senha"),
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  const supabase = await criarClienteServidor();
  const voltar = destinoSeguro(form.get("voltar"));
  const { data, error } = await supabase.auth.signUp({
    email: dados.data.email, password: dados.data.senha,
    options: { data: { nome: dados.data.nome }, emailRedirectTo: `${urlDoSite()}/auth/callback?voltar=${encodeURIComponent(voltar)}` },
  });
  if (error) return { erro: "Não foi possível criar a conta. O e-mail pode já estar cadastrado." };
  if (!data.session) return { aviso: "Conta criada. Confirme pelo link enviado ao seu e-mail para entrar." };
  redirect(voltar === "/painel" ? "/empresa" : voltar);
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
