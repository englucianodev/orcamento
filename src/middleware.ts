import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/entrar", "/cadastro", "/auth", "/convite"];

/** Renova a sessão do Supabase a cada requisição e protege as páginas internas. */
export async function middleware(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return resposta;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(lista, headers) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) resposta.headers.set(k, v);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const caminho = request.nextUrl.pathname;
  const publica = caminho === "/" || PUBLICAS.some((p) => caminho.startsWith(p));
  if (!data.user && !publica && !caminho.startsWith("/api")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    destino.searchParams.set("voltar", caminho);
    return NextResponse.redirect(destino);
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
