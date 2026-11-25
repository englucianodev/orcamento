import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { envPublico } from "./env";

/** Cliente do servidor com a sessão do usuário (cookies). Um por requisição. */
export async function criarClienteServidor(): Promise<SupabaseClient> {
  const loja = await cookies();
  const { url, anonKey } = envPublico();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) loja.set(name, value, options);
        } catch {
          // Server Component não pode gravar cookies; o middleware renova a sessão.
        }
      },
    },
  });
}

/** Usuário autenticado (validado no servidor do Supabase) ou redireciona para o login. */
export async function exigirUsuario(): Promise<{ supabase: SupabaseClient; usuario: User }> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/entrar");
  return { supabase, usuario: data.user };
}
