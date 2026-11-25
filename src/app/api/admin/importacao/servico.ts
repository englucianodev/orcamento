import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { excluirBaseCompleta } from "@/lib/importacao/excluir-base";
import {
  chaveImportacao, ordemEtapa, pastaArquivos, type EstadoImportacao, type RequisicaoImportacao,
} from "@/lib/importacao/lotes";

/** Erro com mensagem segura para o usuário e status HTTP. */
export class ErroRota extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ErroRota";
  }
}

type Req<A extends RequisicaoImportacao["acao"]> = Extract<RequisicaoImportacao, { acao: A }>;
type Identificacao = Pick<Req<"estado">, "fonte" | "uf" | "mesAno" | "desonerado" | "hash">;

interface LinhaBase { id: string; arquivo_hash: string | null; importado_em: string | null }
interface LinhaImportacao {
  id: string; base_id: string; etapa: string | null; lote_atual: number; total_lotes: number | null;
  status: string; erros: unknown;
}

const COLUNAS_IMPORTACAO = "id, base_id, etapa, lote_atual, total_lotes, status, erros";
const MAX_ERROS_GUARDADOS = 50;
const RPC_DA_ETAPA = {
  insumos: "importar_insumos", equipamentos: "importar_equipamentos",
  composicoes: "importar_composicoes", itens: "importar_itens",
} as const;

const agora = () => new Date().toISOString();

const vazio = (situacao: EstadoImportacao["situacao"], baseId: string | null = null): EstadoImportacao =>
  ({ situacao, baseId, importacaoId: null, loteAtual: 0, totalLotes: 0, etapa: null });

function estadoDe(imp: LinhaImportacao, situacao: EstadoImportacao["situacao"] = "em_andamento"): EstadoImportacao {
  return {
    situacao, baseId: imp.base_id, importacaoId: imp.id, loteAtual: imp.lote_atual,
    totalLotes: imp.total_lotes ?? 0, etapa: imp.etapa,
  };
}

async function basePorChave(admin: SupabaseClient, d: Identificacao): Promise<LinhaBase | null> {
  const { data, error } = await admin.from("bases_referencia").select("id, arquivo_hash, importado_em")
    .eq("fonte", d.fonte).eq("uf", d.uf).eq("mes_ano", d.mesAno).eq("desonerado", d.desonerado).maybeSingle();
  if (error) throw new Error(`bases_referencia: ${error.message}`);
  return (data as LinhaBase | null) ?? null;
}

async function importacaoAberta(admin: SupabaseClient, baseId: string): Promise<LinhaImportacao | null> {
  const { data, error } = await admin.from("importacoes").select(COLUNAS_IMPORTACAO)
    .eq("base_id", baseId).eq("status", "em_andamento").order("iniciado_em", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`importacoes: ${error.message}`);
  return (data as LinhaImportacao | null) ?? null;
}

async function carregarImportacao(admin: SupabaseClient, id: string): Promise<LinhaImportacao> {
  const { data, error } = await admin.from("importacoes").select(COLUNAS_IMPORTACAO).eq("id", id).maybeSingle();
  if (error) throw new Error(`importacoes: ${error.message}`);
  if (!data) throw new ErroRota("Importação não encontrada (pode ter sido cancelada).", 404);
  return data as LinhaImportacao;
}

function exigirEmAndamento(imp: LinhaImportacao): void {
  if (imp.status !== "em_andamento") throw new ErroRota("Esta importação não está mais em andamento.", 409);
}

/** Situação de uma base para o arquivo informado (para a tela decidir: importar, retomar ou nada). */
export async function consultarEstado(admin: SupabaseClient, d: Identificacao): Promise<EstadoImportacao> {
  const chave = chaveImportacao(d.hash, d.uf, d.desonerado);
  const base = await basePorChave(admin, d);
  if (!base) return vazio("nova");
  if (base.importado_em) return vazio(base.arquivo_hash === chave ? "concluida" : "conflito", base.id);
  if (base.arquivo_hash !== chave) return vazio("nova");
  const imp = await importacaoAberta(admin, base.id);
  return imp ? estadoDe(imp) : vazio("nova");
}

function conferirCaminhos(d: Req<"iniciar">): string {
  const prefixo = `${pastaArquivos(d.fonte, d.uf, d.mesAno)}/${d.hash}-`;
  const validos = d.arquivos.every((p) => p.startsWith(prefixo) && /^[A-Za-z0-9._/-]+$/.test(p) && !p.includes(".."));
  if (!validos) throw new ErroRota("Caminho de arquivo inválido para esta base.");
  return d.arquivos.length === 1 ? (d.arquivos[0] as string) : `${prefixo}*`;
}

export async function iniciarImportacao(admin: SupabaseClient, d: Req<"iniciar">, usuarioId: string): Promise<EstadoImportacao> {
  const arquivoPath = conferirCaminhos(d);
  const chave = chaveImportacao(d.hash, d.uf, d.desonerado);
  const existente = await basePorChave(admin, d);
  if (existente?.importado_em) {
    if (existente.arquivo_hash === chave) return vazio("concluida", existente.id);
    throw new ErroRota(
      "Já existe esta base (fonte, UF, mês e desoneração) importada de outro arquivo. Exclua-a na lista abaixo antes de importar de novo.",
      409,
    );
  }
  if (existente) {
    const mesmoArquivo = existente.arquivo_hash === chave;
    const aberta = mesmoArquivo ? await importacaoAberta(admin, existente.id) : null;
    if (aberta && aberta.total_lotes === d.totalLotes) return estadoDe(aberta);
    // importação incompleta de outro arquivo (ou com outro plano de lotes): recomeça do zero
    await excluirBaseCompleta(admin, existente.id, { manterArquivos: mesmoArquivo });
  }

  const { data: base, error } = await admin.from("bases_referencia").insert({
    fonte: d.fonte, uf: d.uf, mes_ano: d.mesAno, desonerado: d.desonerado, layout: d.layout,
    arquivo_hash: chave, arquivo_path: arquivoPath, avisos: d.avisos, importado_em: null,
  }).select("id").single();
  if (error?.code === "23505") throw new ErroRota("Este arquivo já foi usado em outra importação.", 409);
  if (error || !base) throw new Error(`bases_referencia insert: ${error?.message}`);

  const { data: imp, error: e2 } = await admin.from("importacoes").insert({
    base_id: base.id, etapa: "insumos", lote_atual: 0, total_lotes: d.totalLotes, status: "em_andamento",
    iniciado_por: usuarioId,
  }).select(COLUNAS_IMPORTACAO).single();
  if (e2 || !imp) throw new Error(`importacoes insert: ${e2?.message}`);
  return estadoDe(imp as LinhaImportacao);
}

async function registrarErro(admin: SupabaseClient, imp: LinhaImportacao, indice: number, mensagem: string): Promise<void> {
  const anteriores = Array.isArray(imp.erros) ? imp.erros : [];
  const erros = [...anteriores, { em: agora(), lote: indice, mensagem: mensagem.slice(0, 500) }].slice(-MAX_ERROS_GUARDADOS);
  const { error } = await admin.from("importacoes").update({ erros, atualizado_em: agora() }).eq("id", imp.id);
  if (error) console.error("Falha ao registrar erro da importação", imp.id, error.message);
}

export async function gravarLote(admin: SupabaseClient, d: Req<"lote">): Promise<EstadoImportacao> {
  const imp = await carregarImportacao(admin, d.importacaoId);
  exigirEmAndamento(imp);
  const { lote } = d;
  if (lote.indice < imp.lote_atual) return estadoDe(imp); // já gravado (reenvio após queda)
  if (lote.indice > imp.lote_atual) {
    throw new ErroRota(`Lote fora de ordem: o próximo esperado é o ${imp.lote_atual + 1}.`, 409);
  }
  if (lote.indice >= (imp.total_lotes ?? 0)) throw new ErroRota("Lote além do total previsto para esta importação.");
  if (ordemEtapa(lote.etapa) < ordemEtapa(imp.etapa ?? "insumos")) {
    throw new ErroRota(`Etapa fora de ordem: ${lote.etapa} depois de ${imp.etapa}.`, 409);
  }

  const args = lote.etapa === "itens"
    ? { p_base: imp.base_id, p_lote: lote.indice, p_linhas: lote.linhas }
    : { p_base: imp.base_id, p_linhas: lote.linhas };
  const { error } = await admin.rpc(RPC_DA_ETAPA[lote.etapa], args);
  if (error) {
    console.error("Falha na RPC de importação", imp.id, lote.etapa, lote.indice, error.message);
    await registrarErro(admin, imp, lote.indice, error.message);
    throw new ErroRota(`Falha ao gravar o lote ${lote.indice + 1} (${lote.etapa}). Tente retomar a importação.`, 502);
  }

  const { data, error: e2 } = await admin.from("importacoes")
    .update({ lote_atual: lote.indice + 1, etapa: lote.etapa, atualizado_em: agora() })
    .eq("id", imp.id).eq("lote_atual", lote.indice).select(COLUNAS_IMPORTACAO).maybeSingle();
  if (e2) throw new Error(`importacoes update: ${e2.message}`);
  if (!data) throw new ErroRota("A importação foi atualizada por outra aba. Recarregue a página para retomar.", 409);
  return estadoDe(data as LinhaImportacao);
}

export async function finalizarImportacao(admin: SupabaseClient, d: Req<"finalizar">): Promise<EstadoImportacao> {
  const imp = await carregarImportacao(admin, d.importacaoId);
  exigirEmAndamento(imp);
  if (imp.lote_atual !== imp.total_lotes) {
    throw new ErroRota(`Ainda faltam lotes: ${imp.lote_atual} de ${imp.total_lotes ?? 0} gravados.`, 409);
  }
  await admin.from("importacoes").update({ etapa: "encargos", atualizado_em: agora() }).eq("id", imp.id);
  const { horistaPct, mensalistaPct } = d.encargos;
  if (horistaPct !== null || mensalistaPct !== null) {
    const { error } = await admin.rpc("importar_encargos", {
      p_base: imp.base_id, p_horista: horistaPct, p_mensalista: mensalistaPct,
    });
    if (error) {
      await registrarErro(admin, imp, imp.lote_atual, error.message);
      throw new ErroRota("Falha ao gravar os encargos sociais. Tente finalizar novamente.", 502);
    }
  }
  const { error: e2 } = await admin.from("bases_referencia")
    .update({ validacao: d.validacao, importado_em: agora() }).eq("id", imp.base_id);
  if (e2) throw new Error(`bases_referencia finalizar: ${e2.message}`);
  const { data, error: e3 } = await admin.from("importacoes")
    .update({ status: "concluida", etapa: "validacao", atualizado_em: agora() })
    .eq("id", imp.id).select(COLUNAS_IMPORTACAO).single();
  if (e3 || !data) throw new Error(`importacoes concluir: ${e3?.message}`);
  return estadoDe(data as LinhaImportacao, "concluida");
}

/** Cancela: base incompleta é descartada (dados e arquivos); base já concluída fica intacta. */
export async function cancelarImportacao(admin: SupabaseClient, d: Req<"cancelar">): Promise<{ cancelada: true }> {
  const imp = await carregarImportacao(admin, d.importacaoId);
  const { error } = await admin.from("importacoes").update({ status: "cancelada", atualizado_em: agora() }).eq("id", imp.id);
  if (error) throw new Error(`importacoes cancelar: ${error.message}`);
  const { data: base } = await admin.from("bases_referencia").select("importado_em").eq("id", imp.base_id).maybeSingle();
  if (base && !base.importado_em) await excluirBaseCompleta(admin, imp.base_id);
  return { cancelada: true };
}
