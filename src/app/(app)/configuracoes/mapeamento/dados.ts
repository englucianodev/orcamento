import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  paraMapeamentos, type LinhaMapeamentoBanco, type MapeamentoExibicao,
} from "@/components/configuracoes/mapeamento-efetivo";
import type { BaseOpcao, InfoComposicao, ItemCatalogo } from "@/components/configuracoes/tipos-mapeamento";
import { rotuloBase } from "@/lib/orcamento/bases";

export interface DadosMapeamento {
  catalogo: ItemCatalogo[];
  mapeamentos: MapeamentoExibicao[];
  bases: BaseOpcao[];
  referencia: { SINAPI: BaseOpcao | null; SICRO: BaseOpcao | null };
  /** descrição/unidade da composição por "FONTE|codigo" (SINAPI/SICRO na base de referência) */
  composicoes: Record<string, InfoComposicao>;
  erros: string[];
}

interface LinhaBase { id: string; fonte: "SINAPI" | "SICRO"; uf: string; mes_ano: string; desonerado: boolean }
interface LinhaComposicao { codigo: string; descricao: string | null; unidade: string | null }

export const chaveComposicao = (fonte: string, codigo: string): string => `${fonte}|${codigo}`;

async function infoComposicoes(
  supabase: SupabaseClient, fonte: string, codigos: string[], filtro: { baseId: string } | { empresaId: string },
): Promise<{ mapa: Record<string, InfoComposicao>; erro: string | null }> {
  if (!codigos.length) return { mapa: {}, erro: null };
  let q = supabase.from("composicoes").select("codigo, descricao, unidade").in("codigo", codigos);
  q = "baseId" in filtro ? q.eq("base_id", filtro.baseId) : q.eq("empresa_id", filtro.empresaId).is("base_id", null);
  const { data, error } = await q;
  if (error) return { mapa: {}, erro: `Falha ao ler composições ${fonte}: ${error.message}` };
  const mapa: Record<string, InfoComposicao> = {};
  for (const c of (data ?? []) as LinhaComposicao[]) mapa[chaveComposicao(fonte, c.codigo)] = { descricao: c.descricao, unidade: c.unidade };
  return { mapa, erro: null };
}

/** Catálogo, mapeamentos (global + empresa), bases importadas e a descrição das composições mapeadas. */
export async function carregarMapeamento(
  supabase: SupabaseClient, empresaId: string, escolha: { sinapi?: string; sicro?: string },
): Promise<DadosMapeamento> {
  const [cat, map, bas] = await Promise.all([
    supabase.from("servicos_catalogo").select("chave, descricao, unidade, etapa, ordem").order("ordem"),
    supabase.from("servicos_mapeamento").select("id, empresa_id, chave, padrao, fonte, codigo, fator_conversao::text")
      .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`),
    supabase.from("bases_referencia").select("id, fonte, uf, mes_ano, desonerado")
      .not("importado_em", "is", null).order("mes_ano", { ascending: false }).order("uf"),
  ]);
  const erros = [cat.error, map.error, bas.error].filter((e) => e !== null).map((e) => `Falha ao carregar dados: ${e.message}`);

  const bases: BaseOpcao[] = ((bas.data ?? []) as LinhaBase[]).map((b) => ({
    id: b.id, fonte: b.fonte, rotulo: rotuloBase(b.fonte, b.uf, b.mes_ano, b.desonerado),
  }));
  const ref = (fonte: "SINAPI" | "SICRO", id?: string) =>
    bases.find((b) => b.fonte === fonte && b.id === id) ?? bases.find((b) => b.fonte === fonte) ?? null;
  const referencia = { SINAPI: ref("SINAPI", escolha.sinapi), SICRO: ref("SICRO", escolha.sicro) };

  const mapeamentos = paraMapeamentos((map.data ?? []) as unknown as LinhaMapeamentoBanco[]);
  const codigosDe = (fonte: string) => [...new Set(mapeamentos.filter((m) => m.fonte === fonte).map((m) => m.codigo))];
  const consultas = await Promise.all([
    referencia.SINAPI ? infoComposicoes(supabase, "SINAPI", codigosDe("SINAPI"), { baseId: referencia.SINAPI.id }) : null,
    referencia.SICRO ? infoComposicoes(supabase, "SICRO", codigosDe("SICRO"), { baseId: referencia.SICRO.id }) : null,
    infoComposicoes(supabase, "PROPRIA", codigosDe("PROPRIA"), { empresaId }),
  ]);
  const composicoes: Record<string, InfoComposicao> = {};
  for (const c of consultas) {
    if (!c) continue;
    Object.assign(composicoes, c.mapa);
    if (c.erro) erros.push(c.erro);
  }
  return { catalogo: (cat.data ?? []) as ItemCatalogo[], mapeamentos, bases, referencia, composicoes, erros };
}
