"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { envPublico } from "./env";

let cliente: SupabaseClient | null = null;

/** Cliente do navegador (chave anônima + sessão do usuário; a RLS protege os dados). */
export function criarClienteNavegador(): SupabaseClient {
  if (!cliente) {
    const { url, anonKey } = envPublico();
    cliente = createBrowserClient(url, anonKey);
  }
  return cliente;
}
