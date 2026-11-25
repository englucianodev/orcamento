import "server-only";
/**
 * Carrega um orçamento já precificado (itens gravados) e calcula os totais com o motor — fonte única
 * para as abas do orçamento e para os relatórios PDF/Excel.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { D, type Dec } from "../engine/decimal";
import { calcularOrcamento, type ResultadoOrcamento } from "../engine/orcamento";
import type { TipoBdi } from "../engine/catalogo";
import type { Entrada } from "../engine/entrada.schema";
import { basesDoOrcamento, type BaseSelecionada } from "./bases";
import type { LinhaBdi } from "./config";
import { bdiDoOrcamento } from "./servico";

export interface OrcamentoDb {
  id: string;
  empresa_id: string;
  nome: string;
  cliente: string | null;
  uf: string | null;
  mes_base: string | null;
  mes_base_sicro: string | null;
  desonerado: boolean | null;
  padrao: string | null;
  entrada: Entrada;
  etapa_assistente: number;
  status: "rascunho" | "revisao" | "aprovado";
  versao: number;
  bdi_servico_id: string | null;
  bdi_material_id: string | null;
  cub_m2: string | null;
  area_construida: string | null;
  dmt: { ln: number; rp: number; p: number };
  responsavel: { nome?: string; registro?: string; art?: string } | null;
  total: string | null;
  aprovado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ItemDb {
  id: string;
  etapa: string;
  numero: string | null;
  chave_servico: string | null;
  ambiente_id: string | null;
  fonte: "SINAPI" | "SICRO" | "PROPRIA" | null;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade: string;
  quantidade_calculada: string | null;
  memoria_calculo: string | null;
  fator_conversao: string;
  custo_unitario: string | null;
  editado_manual: boolean;
  bdi_tipo: TipoBdi;
  alerta: string | null;
  ordem: number;
}

export interface DadosOrcamento {
  orcamento: OrcamentoDb;
  itens: ItemDb[];
  empresa: { id: string; nome: string; cnpj: string | null; logo_path: string | null };
  bdi: { servico: LinhaBdi | null; material: LinhaBdi | null; taxaServico: Dec; taxaMaterial: Dec };
  resultado: ResultadoOrcamento;
  cronograma: Array<{ etapa: string; mes: number; percentual: string }>;
  bases: { sinapi: BaseSelecionada | null; sicro: BaseSelecionada | null; avisos: string[] };
}

export const ehPercentual = (i: Pick<ItemDb, "unidade">): boolean => i.unidade === "%";

export async function carregarOrcamento(supabase: SupabaseClient, id: string): Promise<DadosOrcamento | null> {
  const { data: orc, error } = await supabase.from("orcamentos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Orçamento: ${error.message}`);
  if (!orc) return null;
  const o = orc as OrcamentoDb;
  const [itensR, empresaR, cronoR, bdi, bases] = await Promise.all([
    supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("ordem"),
    supabase.from("empresas").select("id, nome, cnpj, logo_path").eq("id", o.empresa_id).single(),
    supabase.from("cronograma").select("etapa, mes, percentual").eq("orcamento_id", id).order("mes"),
    bdiDoOrcamento(supabase, o.bdi_servico_id, o.bdi_material_id),
    basesDoOrcamento(supabase, o),
  ]);
  if (itensR.error) throw new Error(`Itens: ${itensR.error.message}`);
  if (empresaR.error) throw new Error(`Empresa: ${empresaR.error.message}`);
  const itens = (itensR.data ?? []).map((i) => ({ ...i, quantidade: String(i.quantidade), custo_unitario: i.custo_unitario === null ? null : String(i.custo_unitario) })) as ItemDb[];
  const resultado = calcularOrcamento(
    itens.map((i) => ({ id: i.id, etapa: i.etapa, quantidade: i.quantidade, custoUnitario: i.custo_unitario, bdiTipo: i.bdi_tipo ?? "servico", percentual: ehPercentual(i) })),
    {
      bdiServico: bdi.taxaServico, bdiMaterial: bdi.taxaMaterial,
      areaConstruida: o.area_construida ? new D(o.area_construida) : null,
      cubM2: o.cub_m2 ? new D(o.cub_m2) : null,
    },
  );
  return {
    orcamento: o, itens, empresa: empresaR.data as DadosOrcamento["empresa"], bdi, resultado,
    cronograma: ((cronoR.data ?? []) as Array<{ etapa: string; mes: number; percentual: string | number }>).map((c) => ({ ...c, percentual: String(c.percentual) })),
    bases,
  };
}
