"use server";
/**
 * Ações do orçamento: criação, rascunho do assistente (autosave), prévia dos quantitativos, geração,
 * edição de quantidades, aprovação/versões, simulação de desoneração e reprecificação.
 * Toda entrada é validada com Zod aqui (o navegador valida antes com os mesmos schemas).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { servicoDoCatalogo, nomeEtapa } from "@/lib/engine/catalogo";
import { prazoObra } from "@/lib/engine/cronograma";
import { dadosGeraisSchema, entradaSchema, rascunhoSchema, VERSAO_ENTRADA } from "@/lib/engine/entrada.schema";
import { criarContexto, gerarQuantitativos } from "@/lib/engine/quantitativos";
import { exigirEmpresa } from "@/lib/empresa";
import { metaSchema } from "@/lib/orcamento/meta";
import { carregarConfigEmpresa, recalcularOrcamento, simularOrcamento, type ResumoRecalculo, type Simulacao } from "@/lib/orcamento/servico";
import { exigirUsuario } from "@/lib/supabase/servidor";
import { mensagemDeErro } from "@/lib/utils";

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

const uuid = z.string().uuid();
const mes = z.string().regex(/^\d{4}-\d{2}-01$/, "Mês-base inválido.");
const TAMANHO_MAXIMO_RASCUNHO = 400_000;

function revalidar(id: string) {
  revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/painel");
}

export async function criarOrcamento(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const nome = z.string().trim().min(2, "Dê um nome ao orçamento.").max(120).safeParse(form.get("nome"));
  if (!nome.success) return { erro: nome.error.issues[0]?.message };
  const { supabase, atual } = await exigirEmpresa();
  const { data, error } = await supabase.from("orcamentos").insert({
    empresa_id: atual.id, nome: nome.data, padrao: "normal", desonerado: false,
    entrada: { versao: VERSAO_ENTRADA, dadosGerais: { nome: nome.data, padrao: "normal", pavimentos: 1, desonerado: false } },
  }).select("id").single();
  if (error || !data) return { erro: "Sem permissão para criar orçamentos nesta empresa." };
  redirect(`/orcamentos/${data.id}/assistente`);
}

export async function salvarRascunho(id: string, entrada: unknown, etapa: number, meta: unknown): Promise<EstadoAcao> {
  const ok = uuid.safeParse(id).success && z.number().int().min(1).max(10).safeParse(etapa).success;
  const r = rascunhoSchema.safeParse(entrada);
  const m = metaSchema.safeParse(meta);
  if (!ok || !r.success) return { erro: "Rascunho inválido." };
  if (!m.success) return { erro: m.error.issues[0]?.message ?? "Dados do orçamento inválidos." };
  if (JSON.stringify(r.data).length > TAMANHO_MAXIMO_RASCUNHO) return { erro: "Rascunho grande demais." };
  const dg = dadosGeraisSchema.partial().safeParse((r.data as { dadosGerais?: unknown }).dadosGerais ?? {});
  const g = dg.success ? dg.data : {};
  // O BDI só é escolhido no passo 9: antes dele o rascunho não regrava o BDI (que pode ter sido
  // trocado na aba BDI do orçamento enquanto o assistente estava aberto em outra aba).
  const { bdi_servico_id, bdi_material_id, ...metaSemBdi } = m.data;
  const { supabase } = await exigirUsuario();
  const { error } = await supabase.from("orcamentos").update({
    entrada: r.data, etapa_assistente: etapa,
    ...(g.nome ? { nome: g.nome } : {}), cliente: g.cliente || null, uf: g.uf ?? null, mes_base: g.mesBase ?? null,
    desonerado: g.desonerado ?? false, padrao: g.padrao ?? null,
    ...metaSemBdi, ...(etapa >= 9 ? { bdi_servico_id, bdi_material_id } : {}), atualizado_em: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { erro: error.code === "42501" ? "Orçamento aprovado: reabra para editar." : `Não foi possível salvar: ${error.message}` };
  return { ok: "Salvo" };
}

export interface ItemPrevia {
  etapa: string;
  nomeEtapa: string;
  chave: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  ambiente: string | null;
  memoria: string;
}

export interface Previa {
  erro?: string;
  itens?: ItemPrevia[];
  areaConstruida?: string;
  memorias?: string[];
}

/** Quantitativos com a configuração da empresa, sem preço (etapa 8 do assistente). */
export async function previaQuantitativos(id: string, entrada: unknown): Promise<Previa> {
  if (!uuid.safeParse(id).success) return { erro: "Orçamento inválido." };
  const e = entradaSchema.safeParse(entrada);
  if (!e.success) {
    const i = e.error.issues[0];
    return { erro: `Revise o assistente: ${i?.path.join(" › ")} — ${i?.message}` };
  }
  try {
    const { supabase, atual } = await exigirEmpresa();
    const { data: orc } = await supabase.from("orcamentos").select("empresa_id").eq("id", id).maybeSingle();
    const { config } = await carregarConfigEmpresa(supabase, (orc?.empresa_id as string | undefined) ?? atual.id);
    const ctx = criarContexto(e.data, config);
    const nomes = new Map(e.data.ambientes.map((a) => [a.id, a.nome]));
    const itens = gerarQuantitativos(e.data, config).map((q): ItemPrevia => ({
      etapa: q.etapa, nomeEtapa: nomeEtapa(q.etapa), chave: q.chaveServico, descricao: servicoDoCatalogo(q.chaveServico).descricao,
      unidade: q.unidade, quantidade: q.quantidade, ambiente: q.ambienteId ? nomes.get(q.ambienteId) ?? null : null, memoria: q.memoria,
    }));
    const prazo = prazoObra(ctx.geo.areaConstruida, e.data.dadosGerais.padrao, config.indices, config.tabelas);
    return {
      itens, areaConstruida: ctx.geo.areaConstruida.toFixed(2),
      memorias: [...ctx.geo.pavimentos.map((p) => p.memoriaProjecao), prazo.memoria],
    };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

export interface EstadoGeracao extends EstadoAcao {
  resumo?: ResumoRecalculo;
}

export async function gerarOrcamento(id: string): Promise<EstadoGeracao> {
  if (!uuid.safeParse(id).success) return { erro: "Orçamento inválido." };
  try {
    const { supabase } = await exigirUsuario();
    const resumo = await recalcularOrcamento(supabase, id);
    revalidar(id);
    return { ok: "Orçamento gerado.", resumo };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

const idDoForm = (form: FormData) => uuid.parse(form.get("id"));
const motivoSchema = z.string().trim().max(300).optional();
const motivoDoForm = (form: FormData) => motivoSchema.parse(form.get("motivo") ?? undefined) || null;

export async function recalcular(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const r = await gerarOrcamento(String(form.get("id")));
  return r.erro ? { erro: r.erro } : { ok: `Recalculado: ${r.resumo?.itens ?? 0} itens.` };
}

export async function aprovar(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const id = idDoForm(form);
    const { supabase } = await exigirUsuario();
    const { error } = await supabase.rpc("aprovar_orcamento", { p_orcamento: id, p_motivo: motivoDoForm(form) });
    if (error) return { erro: error.message };
    revalidar(id);
    return { ok: "Orçamento aprovado e versão registrada." };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

export async function reabrir(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const id = idDoForm(form);
    const { supabase } = await exigirUsuario();
    const { data, error } = await supabase.rpc("reabrir_orcamento", { p_orcamento: id, p_motivo: motivoDoForm(form) });
    if (error) return { erro: error.message };
    revalidar(id);
    return { ok: `Reaberto como versão ${String(data)}.` };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

const quantidadeSchema = z.string().trim().transform((v) => v.replace(",", "."))
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,4})?$/, "Quantidade inválida (número com até 4 casas)."));

const ITEM_DESATUALIZADO = "A planilha mudou desde que você abriu esta linha (o orçamento foi recalculado). Recarregue e edite de novo.";
const erroDeItem = (codigo: string | undefined) =>
  codigo === "42501" ? "Orçamento aprovado ou sem permissão: reabra para editar." : "Não foi possível salvar a quantidade.";

/** Quantidade editada à mão: fica marcada e é preservada nos recálculos. */
export async function editarQuantidade(orcamentoId: string, itemId: string, valor: string): Promise<EstadoAcao> {
  const q = quantidadeSchema.safeParse(valor);
  if (!uuid.safeParse(orcamentoId).success || !uuid.safeParse(itemId).success) return { erro: "Item inválido." };
  if (!q.success) return { erro: q.error.issues[0]?.message };
  const { supabase } = await exigirUsuario();
  const { data, error } = await supabase.from("orcamento_itens").update({ quantidade: q.data, editado_manual: true })
    .eq("id", itemId).eq("orcamento_id", orcamentoId).select("id");
  if (error) return { erro: erroDeItem(error.code) };
  if (!data?.length) return { erro: ITEM_DESATUALIZADO };
  const r = await gerarOrcamento(orcamentoId);
  return r.erro ? { erro: r.erro } : { ok: "Quantidade atualizada." };
}

export async function restaurarQuantidade(orcamentoId: string, itemId: string): Promise<EstadoAcao> {
  if (!uuid.safeParse(orcamentoId).success || !uuid.safeParse(itemId).success) return { erro: "Item inválido." };
  const { supabase } = await exigirUsuario();
  const { data, error } = await supabase.from("orcamento_itens").update({ editado_manual: false })
    .eq("id", itemId).eq("orcamento_id", orcamentoId).select("id");
  if (error) return { erro: erroDeItem(error.code) };
  if (!data?.length) return { erro: ITEM_DESATUALIZADO };
  const r = await gerarOrcamento(orcamentoId);
  return r.erro ? { erro: r.erro } : { ok: "Quantidade calculada restaurada." };
}

export interface ResultadoSimulacao {
  erro?: string;
  atual?: Simulacao;
  alternativa?: Simulacao;
}

/** Compara o total atual com o da desoneração oposta, sem gravar nada. */
export async function simularDesoneracao(id: string): Promise<ResultadoSimulacao> {
  if (!uuid.safeParse(id).success) return { erro: "Orçamento inválido." };
  try {
    const { supabase } = await exigirUsuario();
    const { data } = await supabase.from("orcamentos").select("desonerado").eq("id", id).single();
    const desonerado = Boolean(data?.desonerado);
    const rot = (d: boolean) => (d ? "Desonerado" : "Não desonerado");
    const [atual, alternativa] = await Promise.all([
      simularOrcamento(supabase, id, {}, rot(desonerado)),
      simularOrcamento(supabase, id, { desonerado: !desonerado }, rot(!desonerado)),
    ]);
    return { atual, alternativa };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

/** Reprecifica o orçamento para outra data-base (e, opcionalmente, desoneração). */
export async function reprecificar(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const d = z.object({
    id: uuid, mes_base: mes, mes_base_sicro: mes.or(z.literal("")).transform((v) => v || null),
    desonerado: z.enum(["sim", "nao"]).transform((v) => v === "sim"),
  }).safeParse({ id: form.get("id"), mes_base: form.get("mes_base"), mes_base_sicro: form.get("mes_base_sicro") ?? "", desonerado: form.get("desonerado") });
  if (!d.success) return { erro: d.error.issues[0]?.message };
  try {
    const { supabase } = await exigirUsuario();
    const { data: orc } = await supabase.from("orcamentos").select("entrada").eq("id", d.data.id).single();
    const entrada = orc?.entrada as { dadosGerais?: Record<string, unknown> } | undefined;
    // a entrada nova só é gravada junto com o recálculo (mesma transação): se ele falhar, nada muda
    const novaEntrada = entrada?.dadosGerais
      ? { ...entrada, dadosGerais: { ...entrada.dadosGerais, mesBase: d.data.mes_base, desonerado: d.data.desonerado } }
      : undefined;
    const r = await recalcularOrcamento(supabase, d.data.id, {
      mes_base: d.data.mes_base, mes_base_sicro: d.data.mes_base_sicro, desonerado: d.data.desonerado,
    }, { entrada: novaEntrada });
    revalidar(d.data.id);
    return { ok: `Reprecificado: ${r.itens} itens, ${r.semComposicao} sem custo.` };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

export async function definirBdi(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const d = z.object({ id: uuid, servico: uuid.nullable(), material: uuid.nullable() }).safeParse({
    id: form.get("id"), servico: form.get("servico") || null, material: form.get("material") || null,
  });
  if (!d.success) return { erro: "BDI inválido." };
  const { supabase } = await exigirUsuario();
  const { error } = await supabase.from("orcamentos").update({ bdi_servico_id: d.data.servico, bdi_material_id: d.data.material }).eq("id", d.data.id);
  if (error) return { erro: error.code === "42501" ? "Orçamento aprovado: reabra para alterar o BDI." : error.message };
  const r = await gerarOrcamento(d.data.id);
  return r.erro ? { erro: r.erro } : { ok: "BDI aplicado e orçamento recalculado." };
}

/** Exclui (só admin da empresa, pela RLS) orçamentos não aprovados. */
export async function excluirOrcamento(form: FormData): Promise<void> {
  const id = idDoForm(form);
  const { supabase } = await exigirUsuario();
  const { data } = await supabase.from("orcamentos").select("status").eq("id", id).maybeSingle();
  if (data && data.status !== "aprovado") await supabase.from("orcamentos").delete().eq("id", id);
  revalidatePath("/painel");
  redirect("/painel");
}
