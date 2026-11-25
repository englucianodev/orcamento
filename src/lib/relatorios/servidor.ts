import "server-only";
/**
 * Lado servidor dos relatórios: autentica, carrega o orçamento (RLS garante a participação na empresa),
 * busca os extras (fechamento das composições por base, encargos, faixas do TCU, logo) e responde
 * com o arquivo. Usado pelas rotas /api/relatorios/[id]/pdf e /xlsx.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { carregarOrcamento, type DadosOrcamento } from "../orcamento/carregar";
import type { LinhaFaixa } from "../orcamento/config";
import { fechamentoSchema, type Fechamento } from "../orcamento/fechamento";
import { criarClienteServidor } from "../supabase/servidor";
import { gerarExcel } from "./excel";
import { montarModeloRelatorio } from "./modelo";
import { gerarPdf, logoParaPdf, type LogoPdf } from "./pdf";
import type { LinhaEncargosDb } from "./secoes";
import { tipoRelatorioSchema, type TipoRelatorio } from "./tipos-relatorio";

const parametrosSchema = z.object({
  id: z.uuid({ message: "Identificador de orçamento inválido." }),
  tipo: tipoRelatorioSchema.default("completo"),
});

const erro = (status: number, mensagem: string) => NextResponse.json({ ok: false, erro: mensagem }, { status });

function dataEmissao(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}

/** Nome de arquivo seguro: "residencia-silva-sintetica-v2.pdf". */
export function nomeArquivo(nome: string, tipo: TipoRelatorio, versao: number, extensao: "pdf" | "xlsx"): string {
  const slug = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return `${slug || "orcamento"}-${tipo}-v${versao}.${extensao}`;
}

async function fechamento(supabase: SupabaseClient, baseId: string, codigos: string[]): Promise<Fechamento> {
  const r = await supabase.rpc("fechamento_composicoes", { p_base: baseId, p_codigos: codigos });
  if (r.error) throw new Error(r.error.message);
  return fechamentoSchema.parse(r.data);
}

async function fechamentos(supabase: SupabaseClient, dados: DadosOrcamento, avisos: string[]) {
  const codigos = (fonte: "SINAPI" | "SICRO") =>
    [...new Set(dados.itens.filter((i) => i.fonte === fonte && i.codigo && i.unidade !== "%").map((i) => i.codigo!))];
  const abrir = async (fonte: "SINAPI" | "SICRO", base: { id: string } | null): Promise<Fechamento | null> => {
    const lista = codigos(fonte);
    if (!lista.length) return null;
    if (!base) {
      avisos.push(`Base ${fonte} do orçamento não importada: composições ${fonte} sem detalhamento.`);
      return null;
    }
    try {
      return await fechamento(supabase, base.id, lista);
    } catch (e) {
      console.error(`[relatorios] fechamento ${fonte} do orçamento ${dados.orcamento.id}:`, e);
      avisos.push(`Não foi possível abrir as composições ${fonte}; o detalhamento foi omitido.`);
      return null;
    }
  };
  const [sinapi, sicro] = await Promise.all([abrir("SINAPI", dados.bases.sinapi), abrir("SICRO", dados.bases.sicro)]);
  return { sinapi, sicro };
}

async function encargosEFaixas(supabase: SupabaseClient, dados: DadosOrcamento) {
  const ids = [dados.bases.sinapi?.id, dados.bases.sicro?.id].filter((x): x is string => Boolean(x));
  const [enc, fx] = await Promise.all([
    ids.length ? supabase.from("encargos_sociais").select("base_id, horista_pct, mensalista_pct").in("base_id", ids) : Promise.resolve({ data: [], error: null }),
    supabase.from("bdi_faixas").select("tipo_obra, componente, minimo, medio, maximo"),
  ]);
  if (enc.error) throw new Error(`Encargos sociais: ${enc.error.message}`);
  if (fx.error) throw new Error(`Faixas de BDI: ${fx.error.message}`);
  return { encargos: (enc.data ?? []) as LinhaEncargosDb[], faixas: (fx.data ?? []) as LinhaFaixa[] };
}

/** Logo da empresa (bucket privado `logos`); PNG/JPEG apenas. Falha não impede o relatório. */
async function baixarLogo(supabase: SupabaseClient, caminho: string | null): Promise<LogoPdf | null> {
  if (!caminho) return null;
  const { data, error } = await supabase.storage.from("logos").download(caminho);
  if (error || !data) {
    console.error(`[relatorios] logo ${caminho}:`, error?.message ?? "sem conteúdo");
    return null;
  }
  return logoParaPdf(new Uint8Array(await data.arrayBuffer()));
}

export async function prepararRelatorio(supabase: SupabaseClient, id: string, comLogo: boolean) {
  const dados = await carregarOrcamento(supabase, id);
  if (!dados) return null;
  const avisos: string[] = [];
  const [composicoes, { encargos, faixas }, logo] = await Promise.all([
    fechamentos(supabase, dados, avisos),
    encargosEFaixas(supabase, dados),
    comLogo ? baixarLogo(supabase, dados.empresa.logo_path) : Promise.resolve(null),
  ]);
  const modelo = montarModeloRelatorio(dados, { dataEmissao: dataEmissao(), composicoes, encargos, faixas, avisos });
  return { dados, modelo, logo };
}

const TIPOS_MIME = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/** Handler GET comum às duas rotas. */
export async function responderRelatorio(request: Request, idBruto: string, formato: "pdf" | "xlsx"): Promise<Response> {
  const tipoBruto = new URL(request.url).searchParams.get("tipo") ?? undefined;
  const p = parametrosSchema.safeParse({ id: idBruto, tipo: tipoBruto });
  if (!p.success) return erro(400, p.error.issues.some((i) => i.path[0] === "id") ? "Orçamento inválido." : "Tipo de relatório inválido.");
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return erro(401, "Sessão expirada. Entre novamente para gerar o relatório.");
    const preparado = await prepararRelatorio(supabase, p.data.id, formato === "pdf");
    if (!preparado) return erro(404, "Orçamento não encontrado ou sem acesso.");
    const { dados, modelo, logo } = preparado;
    const bytes = formato === "pdf" ? new Uint8Array(await gerarPdf(modelo, p.data.tipo, logo)) : await gerarExcel(modelo, p.data.tipo);
    const nome = nomeArquivo(dados.orcamento.nome, p.data.tipo, dados.orcamento.versao, formato);
    return new NextResponse(bytes as Uint8Array<ArrayBuffer>, {
      status: 200,
      headers: {
        "Content-Type": TIPOS_MIME[formato],
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error(`[relatorios] ${formato} ${p.data.tipo} do orçamento ${p.data.id}:`, e);
    return erro(500, "Não foi possível gerar o relatório. Tente novamente em instantes.");
  }
}
