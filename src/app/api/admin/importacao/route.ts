/**
 * Importação das bases oficiais em lotes (seção 5). O navegador lê as planilhas e envia lotes
 * de até 1000 linhas; aqui cada pedido é validado com Zod e gravado com a service role, depois
 * de confirmar que o usuário logado é administrador da plataforma.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requisicaoImportacaoSchema, type RespostaImportacao } from "@/lib/importacao/lotes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  ErroRota, cancelarImportacao, consultarEstado, finalizarImportacao, gravarLote, iniciarImportacao,
} from "./servico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_CORPO_BYTES = 4 * 1024 * 1024;

function responder<T>(corpo: RespostaImportacao<T>, status = 200): NextResponse<RespostaImportacao<T>> {
  return NextResponse.json(corpo, { status, headers: { "Cache-Control": "no-store" } });
}

async function exigirAdmin(): Promise<string> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ErroRota("Sessão expirada. Entre novamente.", 401);
  const { data: admin, error: e2 } = await supabase.from("admins_plataforma")
    .select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (e2) throw new Error(`admins_plataforma: ${e2.message}`);
  if (!admin) throw new ErroRota("Apenas administradores da plataforma podem importar bases.", 403);
  return data.user.id;
}

async function lerCorpo(req: NextRequest): Promise<unknown> {
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > LIMITE_CORPO_BYTES) throw new ErroRota("Lote grande demais (limite de 4 MB).", 413);
  const texto = await req.text();
  if (Buffer.byteLength(texto, "utf8") > LIMITE_CORPO_BYTES) throw new ErroRota("Lote grande demais (limite de 4 MB).", 413);
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new ErroRota("Corpo da requisição não é JSON válido.");
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<RespostaImportacao>> {
  try {
    const usuarioId = await exigirAdmin();
    const lido = requisicaoImportacaoSchema.safeParse(await lerCorpo(req));
    if (!lido.success) {
      const problema = lido.error.issues[0];
      const onde = problema?.path.join(".") || "pedido";
      return responder({ ok: false, erro: `Dados inválidos (${onde}): ${problema?.message ?? "formato incorreto"}` }, 400);
    }
    const admin = criarClienteAdmin();
    const pedido = lido.data;
    switch (pedido.acao) {
      case "estado":
        return responder({ ok: true, dados: await consultarEstado(admin, pedido) });
      case "iniciar":
        return responder({ ok: true, dados: await iniciarImportacao(admin, pedido, usuarioId) });
      case "lote":
        return responder({ ok: true, dados: await gravarLote(admin, pedido) });
      case "finalizar":
        return responder({ ok: true, dados: await finalizarImportacao(admin, pedido) });
      case "cancelar":
        return responder({ ok: true, dados: await cancelarImportacao(admin, pedido) });
    }
  } catch (erro) {
    if (erro instanceof ErroRota) return responder({ ok: false, erro: erro.message }, erro.status);
    console.error("Erro na rota de importação", erro instanceof Error ? erro.message : erro);
    return responder({ ok: false, erro: "Erro interno ao processar a importação. Tente novamente." }, 500);
  }
}
