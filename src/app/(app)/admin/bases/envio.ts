/** Funções do navegador para gravar a importação: Storage (arquivo original) e Route Handler (lotes). */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  caminhoArquivo, requisicaoImportacaoSchema, type EstadoImportacao, type Lote, type RequisicaoImportacao,
  type RespostaImportacao,
} from "@/lib/importacao/lotes";
import type { UF } from "@/lib/importacao/parsers/util";

const ROTA = "/api/admin/importacao";
const BUCKET = "bases-oficiais";
const TENTATIVAS = 3;
const ESPERA_BASE_MS = 1500;

/** Erro que não adianta repetir (validação, permissão, conflito). */
class ErroDefinitivo extends Error {}

const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

async function chamarUmaVez<T>(pedido: RequisicaoImportacao): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(ROTA, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido), cache: "no-store",
    });
  } catch {
    throw new Error("Sem conexão com o servidor.");
  }
  let corpo: RespostaImportacao<T> | null = null;
  try {
    corpo = (await resposta.json()) as RespostaImportacao<T>;
  } catch {
    corpo = null;
  }
  if (corpo?.ok && corpo.dados !== undefined) return corpo.dados;
  const mensagem = corpo?.erro ?? `Falha no servidor (HTTP ${resposta.status}).`;
  if (resposta.status >= 400 && resposta.status < 500) throw new ErroDefinitivo(mensagem);
  throw new Error(mensagem);
}

/** Chama a rota com novas tentativas em falhas de rede/servidor (os lotes são idempotentes). */
export async function chamarRota<T>(pedido: RequisicaoImportacao): Promise<T> {
  const valido = requisicaoImportacaoSchema.safeParse(pedido);
  if (!valido.success) throw new Error(`Dados inválidos: ${valido.error.issues[0]?.message ?? "formato incorreto"}`);
  let ultimo: unknown = null;
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa += 1) {
    try {
      return await chamarUmaVez<T>(valido.data);
    } catch (erro) {
      if (erro instanceof ErroDefinitivo) throw erro;
      ultimo = erro;
      await esperar(ESPERA_BASE_MS * (tentativa + 1));
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error("Falha ao comunicar com o servidor.");
}

export interface IdentificacaoBase {
  fonte: "SINAPI" | "SICRO";
  uf: UF;
  mesAno: string;
  desonerado: boolean;
  hash: string;
}

/** Envia os arquivos originais ao bucket privado; "já existe" conta como sucesso (retomada). */
export async function enviarOriginais(supabase: SupabaseClient, id: IdentificacaoBase, arquivos: readonly File[]): Promise<string[]> {
  const caminhos: string[] = [];
  for (const arquivo of arquivos) {
    const caminho = caminhoArquivo(id.fonte, id.uf, id.mesAno, id.hash, arquivo.name);
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
      upsert: false, contentType: arquivo.type || "application/octet-stream",
    });
    if (error && !/exist|duplicate/i.test(error.message)) {
      throw new Error(`Não foi possível guardar "${arquivo.name}" no Storage: ${error.message}`);
    }
    caminhos.push(caminho);
  }
  return caminhos;
}

/** Envia os lotes a partir do índice `inicio`, em sequência, avisando o progresso. */
export async function enviarLotes(
  importacaoId: string, lotes: readonly Lote[], inicio: number,
  aoGravar: (estado: EstadoImportacao, lote: Lote) => void, cancelado: () => boolean,
): Promise<void> {
  for (const lote of lotes.slice(inicio)) {
    if (cancelado()) throw new Error("Envio interrompido. Use \"Retomar\" para continuar de onde parou.");
    const estado = await chamarRota<EstadoImportacao>({ acao: "lote", importacaoId, lote });
    aoGravar(estado, lote);
  }
}
