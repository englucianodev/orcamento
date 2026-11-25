import "server-only";
/**
 * Recalcula um orçamento: entrada → quantitativos (motor) → mapeamento + bases oficiais → itens com
 * custo → totais com BDI → cronograma. Grava itens e cronograma em transação (RPCs da migration 0004).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ETAPAS, type Etapa } from "../engine/catalogo";
import { prazoObra, distribuirCronograma } from "../engine/cronograma";
import { D } from "../engine/decimal";
import { entradaSchema } from "../engine/entrada.schema";
import { calcularOrcamento } from "../engine/orcamento";
import { criarContexto, gerarQuantitativos } from "../engine/quantitativos";
import { basesDoOrcamento } from "./bases";
import { montarConfigMotor, taxaBdi, type LinhaBdi } from "./config";
import { fechamentoSchema, fontePropria, fonteSicro, fonteSinapi, type FonteCusto } from "./fechamento";
import { chaveLinha, codigosNecessarios, precificarItens, type FonteMapeamento, type LinhaOrcamento, type Mapeamento } from "./precificar";

export interface ResumoRecalculo {
  total: string;
  itens: number;
  semComposicao: number;
  avisos: string[];
}

const ORDEM_ETAPA = new Map<string, number>(ETAPAS.map((e, i) => [e.id, i + 1]));

function verificar<T>(r: { data: T | null; error: { message: string } | null }, contexto: string): T {
  if (r.error) throw new Error(`${contexto}: ${r.error.message}`);
  return r.data as T;
}

export async function carregarConfigEmpresa(supabase: SupabaseClient, empresaId: string) {
  const filtro = `empresa_id.is.null,empresa_id.eq.${empresaId}`;
  const [indices, padroes, tabelas, mapeamentos] = await Promise.all([
    supabase.from("indices_parametricos").select("empresa_id, chave, valor").or(filtro),
    supabase.from("padroes_acabamento").select("empresa_id, padrao, config").or(filtro),
    supabase.from("tabelas_parametricas").select("empresa_id, chave, config").or(filtro),
    supabase.from("servicos_mapeamento").select("empresa_id, chave, padrao, fonte, codigo, fator_conversao").or(filtro),
  ]);
  const config = montarConfigMotor({
    indices: verificar(indices, "Índices"), padroes: verificar(padroes, "Padrões"), tabelas: verificar(tabelas, "Tabelas"),
  });
  const maps = verificar(mapeamentos, "Mapeamento") as Array<{ empresa_id: string | null; chave: string; padrao: Mapeamento["padrao"]; fonte: FonteMapeamento; codigo: string; fator_conversao: string | number }>;
  return {
    config,
    mapeamentos: maps.map((m): Mapeamento => ({
      empresaId: m.empresa_id, chave: m.chave, padrao: m.padrao, fonte: m.fonte, codigo: m.codigo, fatorConversao: String(m.fator_conversao),
    })),
  };
}

async function fechamento(supabase: SupabaseClient, baseId: string, codigos: string[]) {
  const r = await supabase.rpc("fechamento_composicoes", { p_base: baseId, p_codigos: codigos });
  return fechamentoSchema.parse(verificar(r, "Fechamento de composições"));
}

export async function bdiDoOrcamento(supabase: SupabaseClient, servicoId: string | null, materialId: string | null) {
  const { data, error } = await supabase.from("bdi_config").select("id, nome, tipo, tipo_obra, ac, s, r, g, df, l, i, empresa_id");
  if (error) throw new Error(`BDI: ${error.message}`);
  const lista = (data ?? []) as Array<LinhaBdi & { empresa_id: string | null }>;
  const escolher = (id: string | null, tipo: "servico" | "material") =>
    lista.find((b) => b.id === id) ?? lista.find((b) => b.tipo === tipo && b.empresa_id !== null) ?? lista.find((b) => b.tipo === tipo) ?? null;
  const servico = escolher(servicoId, "servico");
  const material = escolher(materialId, "material");
  return { servico, material, taxaServico: taxaBdi(servico), taxaMaterial: taxaBdi(material) };
}

function paraBanco(linhas: readonly LinhaOrcamento[]) {
  const contador = new Map<string, number>();
  return linhas.map((l) => {
    const n = (contador.get(l.etapa) ?? 0) + 1;
    contador.set(l.etapa, n);
    return {
      etapa: l.etapa, numero: `${ORDEM_ETAPA.get(l.etapa) ?? 0}.${n}`, chave_servico: l.chaveServico, ambiente_id: l.ambienteId,
      fonte: l.fonte, codigo: l.codigo, descricao: l.descricao, unidade: l.unidade, quantidade: l.quantidade,
      quantidade_calculada: l.quantidadeCalculada, memoria_calculo: l.memoria, fator_conversao: l.fatorConversao,
      custo_unitario: l.custoUnitario, editado_manual: l.editadoManual, bdi_tipo: l.bdiTipo, alerta: l.alerta, ordem: l.ordem,
    };
  });
}

export interface Sobrescritas {
  desonerado?: boolean;
  mes_base?: string;
  mes_base_sicro?: string | null;
}

/** Calcula o orçamento sem gravar (também usado para simular desoneração/nova data-base). */
export async function calcularOrcamentoCompleto(supabase: SupabaseClient, orcamentoId: string, sobrescritas: Sobrescritas = {}) {
  const lido = verificar(await supabase.from("orcamentos")
    .select("id, empresa_id, status, entrada, uf, mes_base, mes_base_sicro, desonerado, dmt, bdi_servico_id, bdi_material_id, cub_m2")
    .eq("id", orcamentoId).single(), "Orçamento") as {
      id: string; empresa_id: string; status: string; entrada: unknown; uf: string | null; mes_base: string | null; mes_base_sicro: string | null;
      desonerado: boolean | null; dmt: { ln: number; rp: number; p: number } | null; bdi_servico_id: string | null; bdi_material_id: string | null;
    };
  const orc = { ...lido, ...sobrescritas };
  const validada = entradaSchema.safeParse(orc.entrada);
  if (!validada.success) throw new Error(`Dados da obra incompletos: ${validada.error.issues[0]?.message ?? "revise o assistente"}.`);
  const entrada = validada.data;
  const { config, mapeamentos } = await carregarConfigEmpresa(supabase, orc.empresa_id);
  const itens = gerarQuantitativos(entrada, config);
  const ctx = criarContexto(entrada, config);
  const padrao = entrada.dadosGerais.padrao;

  const { sinapi, sicro, avisos } = await basesDoOrcamento(supabase, orc);
  const codigos = codigosNecessarios(itens, padrao, mapeamentos);
  const fontes: Partial<Record<FonteMapeamento, FonteCusto>> = {};
  if (sinapi && codigos.SINAPI.length) fontes.SINAPI = fonteSinapi(await fechamento(supabase, sinapi.id, codigos.SINAPI), sinapi.rotulo);
  if (sicro && codigos.SICRO.length) fontes.SICRO = fonteSicro(await fechamento(supabase, sicro.id, codigos.SICRO), sicro.rotulo, orc.dmt ?? { ln: 0, rp: 0, p: 0 });
  if (codigos.PROPRIA.length) {
    const r = verificar(await supabase.from("composicoes").select("codigo, descricao, unidade, preco_publicado")
      .eq("empresa_id", orc.empresa_id).is("base_id", null).in("codigo", codigos.PROPRIA), "Composições próprias") as Array<{ codigo: string; descricao: string | null; unidade: string | null; preco_publicado: string | null }>;
    fontes.PROPRIA = fontePropria(r.map((c) => ({ codigo: c.codigo, descricao: c.descricao ?? c.codigo, unidade: c.unidade ?? "", custo: c.preco_publicado })));
  }

  const anteriores = verificar(await supabase.from("orcamento_itens").select("chave_servico, ambiente_id, quantidade")
    .eq("orcamento_id", orcamentoId).eq("editado_manual", true), "Itens") as Array<{ chave_servico: string; ambiente_id: string | null; quantidade: string }>;
  const edicoesManuais = new Map(anteriores.map((a) => [chaveLinha(a.chave_servico, a.ambiente_id), String(a.quantidade)]));

  const linhas = precificarItens({ itens, padrao, mapeamentos, fontes, edicoesManuais });
  const bdi = await bdiDoOrcamento(supabase, orc.bdi_servico_id, orc.bdi_material_id);
  const resultado = calcularOrcamento(
    linhas.map((l) => ({ id: String(l.ordem), etapa: l.etapa, quantidade: l.quantidade, custoUnitario: l.custoUnitario, bdiTipo: l.bdiTipo, percentual: l.percentual })),
    { bdiServico: bdi.taxaServico, bdiMaterial: bdi.taxaMaterial, areaConstruida: ctx.geo.areaConstruida },
  );
  const prazo = prazoObra(ctx.geo.areaConstruida, padrao, config.indices, config.tabelas);
  return { orc, linhas, resultado, ctx, config, prazo, avisos, padrao };
}

/** Casas do percentual mensal gravado (cronograma.percentual numeric(9,6)). */
const CASAS_PERCENTUAL = 6;

/**
 * Recalcula e grava numa só transação (salvar_calculo): sobrescritas de data-base/desoneração,
 * a entrada nova (quando informada, ex.: reprecificação), os itens e o cronograma.
 */
export async function recalcularOrcamento(
  supabase: SupabaseClient, orcamentoId: string, sobrescritas: Sobrescritas = {}, opcoes: { entrada?: unknown } = {},
): Promise<ResumoRecalculo> {
  const { orc, linhas, resultado, ctx, config, prazo, avisos } = await calcularOrcamentoCompleto(supabase, orcamentoId, sobrescritas);
  if (orc.status === "aprovado") throw new Error("Orçamento aprovado: reabra para gerar uma nova versão antes de recalcular.");

  const crono = distribuirCronograma(
    resultado.totaisEtapa.map((t) => ({ etapa: t.etapa as Etapa, total: t.total })), prazo.meses, config.tabelas.curvaEtapas,
  );
  const linhasCrono = crono.linhas
    .flatMap((l) => l.percentuais.map((p, m) => ({
      etapa: l.etapa, mes: m + 1, percentual: p.times(100).toDecimalPlaces(CASAS_PERCENTUAL).toFixed(CASAS_PERCENTUAL),
    })))
    .filter((l) => new D(l.percentual).gt(0));
  const campos = opcoes.entrada === undefined ? sobrescritas : { ...sobrescritas, entrada: opcoes.entrada };
  verificar(await supabase.rpc("salvar_calculo", {
    p_orcamento: orcamentoId, p_itens: paraBanco(linhas),
    p_resumo: { total: resultado.total.toFixed(2), area_construida: ctx.geo.areaConstruida.toFixed(2) },
    p_cronograma: linhasCrono, p_campos: campos,
  }), "Salvar orçamento");

  return { total: resultado.total.toFixed(2), itens: linhas.length, semComposicao: resultado.semComposicao.length, avisos: [...avisos, prazo.memoria] };
}

export interface Simulacao {
  rotulo: string;
  total: string | null;
  semComposicao: number;
  avisos: string[];
}

/** Simula o total com outra desoneração ou data-base, sem gravar. */
export async function simularOrcamento(supabase: SupabaseClient, orcamentoId: string, sobrescritas: Sobrescritas, rotulo: string): Promise<Simulacao> {
  const { resultado, avisos } = await calcularOrcamentoCompleto(supabase, orcamentoId, sobrescritas);
  return { rotulo, total: resultado.total.toFixed(2), semComposicao: resultado.semComposicao.length, avisos };
}
