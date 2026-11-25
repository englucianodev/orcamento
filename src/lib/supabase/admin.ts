import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { envPublico } from "./env";

/**
 * Cliente com a chave de serviço (ignora RLS). SOMENTE no servidor e somente depois de verificar
 * que o usuário é administrador da plataforma. Nunca exponha esta chave ao navegador.
 */
export function criarClienteAdmin(): SupabaseClient {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  const { url } = envPublico();
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
