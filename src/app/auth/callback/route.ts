import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** Retorno do link mágico / confirmação de e-mail (fluxo PKCE): troca o código pela sessão. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const voltar = url.searchParams.get("voltar") ?? "/painel";
  const destino = voltar.startsWith("/") && !voltar.startsWith("//") && !voltar.startsWith("/\\") ? voltar : "/painel";
  if (code) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
}
