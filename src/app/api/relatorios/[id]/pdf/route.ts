import { responderRelatorio } from "@/lib/relatorios/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/relatorios/<id>/pdf?tipo=proposta|sintetica|analitica|memoria|composicoes|bdi|abc|cronograma|resumo|completo */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return responderRelatorio(request, id, "pdf");
}
