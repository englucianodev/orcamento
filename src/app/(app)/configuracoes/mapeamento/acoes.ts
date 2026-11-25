"use server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensagemBanco } from "@/components/configuracoes/decimais";
import {
  buscaSugestaoSchema, copiaPadraoSchema, mapeamentoSchema, primeiroErro, type DadosMapeamento,
} from "@/components/configuracoes/esquemas";
import type { Sugestao } from "@/components/configuracoes/tipos-mapeamento";
import type { EstadoAcao } from "@/components/configuracoes/tipos";
import { rotuloBase } from "@/lib/orcamento/bases";
import { contextoEdicao } from "../contexto";

const LIMITE_SUGESTOES = 20;

/** Confere se o código existe na base escolhida (ou nas composições próprias da empresa). */
async function conferirCodigo(supabase: SupabaseClient, empresaId: string, d: DadosMapeamento): Promise<string | null> {
  if (d.fonte === "PROPRIA") {
    const { data, error } = await supabase.from("composicoes").select("id")
      .eq("empresa_id", empresaId).is("base_id", null).eq("codigo", d.codigo).maybeSingle();
    if (error) return mensagemBanco(error, "conferir o código");
    return data ? null : `Não há composição própria com o código ${d.codigo}. Cadastre-a em Configurações → Composições próprias.`;
  }
  const { data: base, error: erroBase } = await supabase.from("bases_referencia")
    .select("id, fonte, uf, mes_ano, desonerado, importado_em").eq("id", d.base ?? "").maybeSingle();
  if (erroBase) return mensagemBanco(erroBase, "conferir a base");
  if (!base || !base.importado_em) return "Base não encontrada ou ainda não importada.";
  if (base.fonte !== d.fonte) return `A base escolhida é ${base.fonte}, mas a fonte do mapeamento é ${d.fonte}.`;
  const { data, error } = await supabase.from("composicoes").select("id").eq("base_id", base.id).eq("codigo", d.codigo).maybeSingle();
  if (error) return mensagemBanco(error, "conferir o código");
  return data ? null : `O código ${d.codigo} não existe em ${rotuloBase(base.fonte, base.uf, base.mes_ano, base.desonerado)}.`;
}

export async function salvarMapeamento(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const r = mapeamentoSchema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: primeiroErro(r.error) };
  const d = r.data;
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { supabase, empresaId } = ctx;

  const { data: servico, error: erroCat } = await supabase.from("servicos_catalogo").select("chave").eq("chave", d.chave).maybeSingle();
  if (erroCat) return { erro: mensagemBanco(erroCat, "conferir o serviço") };
  if (!servico) return { erro: "Serviço fora do catálogo." };
  const problema = await conferirCodigo(supabase, empresaId, d);
  if (problema) return { erro: problema };

  // (empresa, chave, padrão, fonte) é única: procura a linha existente em vez de depender do upsert com nulos
  let busca = supabase.from("servicos_mapeamento").select("id").eq("empresa_id", empresaId).eq("chave", d.chave).eq("fonte", d.fonte);
  busca = d.padrao ? busca.eq("padrao", d.padrao) : busca.is("padrao", null);
  const { data: existente, error: erroBusca } = await busca.maybeSingle();
  if (erroBusca) return { erro: mensagemBanco(erroBusca, "salvar o mapeamento") };
  if (d.id && existente && existente.id !== d.id) {
    return { erro: "Já existe um mapeamento da empresa para esta fonte e padrão. Edite-o ou exclua-o primeiro." };
  }
  const linha = { chave: d.chave, padrao: d.padrao, fonte: d.fonte, codigo: d.codigo, fator_conversao: d.fator };
  const alvo = d.id ?? (existente?.id as string | undefined) ?? null;
  const { data, error } = alvo
    ? await supabase.from("servicos_mapeamento").update(linha).eq("id", alvo).eq("empresa_id", empresaId).select("id")
    : await supabase.from("servicos_mapeamento").insert({ ...linha, empresa_id: empresaId }).select("id");
  if (error) return { erro: mensagemBanco(error, "salvar o mapeamento") };
  if (!data?.length) return { erro: "Mapeamento não encontrado nesta empresa." };
  revalidatePath("/configuracoes", "layout");
  return { ok: `Mapeamento salvo: ${d.chave} → ${d.fonte} ${d.codigo}.` };
}

export async function excluirMapeamento(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Mapeamento inválido." };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { error } = await ctx.supabase.from("servicos_mapeamento").delete().eq("id", id.data).eq("empresa_id", ctx.empresaId);
  if (error) return { erro: mensagemBanco(error, "excluir o mapeamento") };
  revalidatePath("/configuracoes", "layout");
  return { ok: "Mapeamento da empresa excluído (vale o global, se houver)." };
}

/** Sugestões de composições (trigram + full text) para o termo, na base escolhida ou nas próprias. */
export async function sugerirComposicoes(entrada: unknown): Promise<{ erro?: string; itens?: Sugestao[] }> {
  const r = buscaSugestaoSchema.safeParse(entrada);
  if (!r.success) return { erro: primeiroErro(r.error) };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  const { base, termo } = r.data;
  const texto = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

  if (base === "PROPRIA") {
    const curinga = termo.replace(/[\\%_]/g, (c) => `\\${c}`);
    const consulta = () => ctx.supabase.from("composicoes").select("codigo, descricao, unidade, preco_publicado::text")
      .eq("empresa_id", ctx.empresaId).is("base_id", null);
    const [porDescricao, porCodigo] = await Promise.all([
      consulta().ilike("descricao", `%${curinga}%`).order("codigo").limit(LIMITE_SUGESTOES),
      consulta().eq("codigo", termo).limit(1),
    ]);
    const erro = porDescricao.error ?? porCodigo.error;
    if (erro) return { erro: mensagemBanco(erro, "buscar composições próprias") };
    const linhas = [...(porCodigo.data ?? []), ...(porDescricao.data ?? [])] as Array<Record<string, unknown>>;
    const vistos = new Set<string>();
    const itens = linhas.filter((l) => !vistos.has(String(l.codigo)) && vistos.add(String(l.codigo))).map((l) => ({
      codigo: String(l.codigo), descricao: texto(l.descricao), unidade: texto(l.unidade), preco: texto(l.preco_publicado), relevancia: null,
    }));
    return { itens };
  }

  const { data, error } = await ctx.supabase.rpc("buscar_composicoes", { p_base: base, p_termo: termo, p_limite: LIMITE_SUGESTOES });
  if (error) return { erro: mensagemBanco(error, "buscar sugestões") };
  const itens = ((data ?? []) as Array<Record<string, unknown>>).map((l) => ({
    codigo: String(l.codigo), descricao: texto(l.descricao), unidade: texto(l.unidade),
    preco: texto(l.preco_publicado), relevancia: texto(l.relevancia),
  }));
  return { itens };
}

/** Copia as linhas da empresa de um padrão para outro (cria ou substitui por chave + fonte). */
export async function copiarMapeamentoPadrao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const r = copiaPadraoSchema.safeParse({ origem: form.get("origem"), destino: form.get("destino") });
  if (!r.success) return { erro: primeiroErro(r.error) };
  const ctx = await contextoEdicao();
  if ("erro" in ctx) return { erro: ctx.erro };
  // uma única instrução no banco (atômica): cria ou atualiza por chave + fonte, sem apagar antes
  const { data, error } = await ctx.supabase.rpc("copiar_mapeamento_padrao", {
    p_empresa: ctx.empresaId, p_origem: r.data.origem, p_destino: r.data.destino,
  });
  if (error) return { erro: mensagemBanco(error, "copiar o mapeamento") };
  const copiados = Number(data ?? 0);
  if (!copiados) return { erro: `A empresa não tem mapeamentos específicos do padrão ${r.data.origem}.` };
  revalidatePath("/configuracoes", "layout");
  return { ok: `${copiados} mapeamento(s) copiado(s) de ${r.data.origem} para ${r.data.destino}.` };
}
