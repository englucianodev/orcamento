/**
 * Bases de referência de um orçamento: SINAPI pela UF/mês/desoneração e SICRO pela UF/mês SICRO.
 * Bases com datas diferentes geram alerta (seção 9).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mesAno } from "../utils";

export interface BaseSelecionada {
  id: string;
  fonte: "SINAPI" | "SICRO";
  uf: string;
  mesAno: string;
  desonerado: boolean;
  rotulo: string;
}

export interface OrcamentoBases {
  uf: string | null;
  mes_base: string | null;
  mes_base_sicro: string | null;
  desonerado: boolean | null;
}

export const rotuloBase = (fonte: string, uf: string, mes: string, desonerado: boolean): string =>
  `${fonte} ${uf} ${mesAno(mes)} ${desonerado ? "desonerado" : "não desonerado"}`;

async function buscar(
  supabase: SupabaseClient, fonte: "SINAPI" | "SICRO", uf: string, mes: string, desonerado: boolean,
): Promise<BaseSelecionada | null> {
  const { data, error } = await supabase.from("bases_referencia").select("id, importado_em")
    .eq("fonte", fonte).eq("uf", uf).eq("mes_ano", mes).eq("desonerado", desonerado).maybeSingle();
  if (error) throw new Error(`Falha ao consultar bases: ${error.message}`);
  if (!data || !data.importado_em) return null;
  return { id: data.id as string, fonte, uf, mesAno: mes, desonerado, rotulo: rotuloBase(fonte, uf, mes, desonerado) };
}

export async function basesDoOrcamento(
  supabase: SupabaseClient, o: OrcamentoBases,
): Promise<{ sinapi: BaseSelecionada | null; sicro: BaseSelecionada | null; avisos: string[] }> {
  const avisos: string[] = [];
  const desonerado = o.desonerado ?? false;
  if (!o.uf) return { sinapi: null, sicro: null, avisos: ["Informe a UF do orçamento."] };
  const sinapi = o.mes_base ? await buscar(supabase, "SINAPI", o.uf, o.mes_base, desonerado) : null;
  const mesSicro = o.mes_base_sicro ?? o.mes_base;
  const sicro = mesSicro ? await buscar(supabase, "SICRO", o.uf, mesSicro, desonerado) : null;
  if (!o.mes_base) avisos.push("Escolha o mês-base SINAPI do orçamento.");
  else if (!sinapi) avisos.push(`Base ${rotuloBase("SINAPI", o.uf, o.mes_base, desonerado)} não importada.`);
  if (sinapi && sicro && sinapi.mesAno !== sicro.mesAno) {
    avisos.push(`Atenção: datas-base diferentes — SINAPI ${mesAno(sinapi.mesAno)} e SICRO ${mesAno(sicro.mesAno)}.`);
  }
  return { sinapi, sicro, avisos };
}

/** Meses com base importada para a UF (para os seletores do assistente). */
export async function mesesDisponiveis(
  supabase: SupabaseClient, uf: string,
): Promise<Array<{ fonte: "SINAPI" | "SICRO"; mes_ano: string; desonerado: boolean }>> {
  const { data, error } = await supabase.from("bases_referencia").select("fonte, mes_ano, desonerado")
    .eq("uf", uf).not("importado_em", "is", null).order("mes_ano", { ascending: false });
  if (error) throw new Error(`Falha ao consultar bases: ${error.message}`);
  return (data ?? []) as Array<{ fonte: "SINAPI" | "SICRO"; mes_ano: string; desonerado: boolean }>;
}
