/**
 * Mapeamento efetivo de cada chave do catálogo para exibição em Configurações → Mapeamento.
 * Usa a mesma precedência da precificação (resolverMapeamento): empresa+padrão, empresa,
 * global+padrão, global; dentro do nível, a preferência de fonte.
 */
import { PADROES, type Padrao } from "@/lib/engine/entrada.schema";
import { resolverMapeamento, type FonteMapeamento, type Mapeamento } from "@/lib/orcamento/precificar";
import { D } from "@/lib/engine/decimal";

export interface LinhaMapeamentoBanco {
  id: string;
  empresa_id: string | null;
  chave: string;
  padrao: string | null;
  fonte: string;
  codigo: string;
  fator_conversao: string | number;
}

export interface MapeamentoExibicao extends Mapeamento {
  id: string;
}

export interface GrupoEfetivo {
  /** padrões cobertos por esta linha (todos os 4 quando ela vale para todos) */
  padroes: Padrao[];
  linha: MapeamentoExibicao | null;
}

export type SituacaoMapeamento = "mapeado" | "parcial" | "nao_mapeado";

export interface ResumoChave {
  grupos: GrupoEfetivo[];
  situacao: SituacaoMapeamento;
}

const FONTES_VALIDAS: readonly string[] = ["SINAPI", "SICRO", "PROPRIA"];

/** Converte as linhas do banco para o tipo da precificação, descartando linhas malformadas. */
export function paraMapeamentos(linhas: readonly LinhaMapeamentoBanco[]): MapeamentoExibicao[] {
  return linhas
    .filter((l) => FONTES_VALIDAS.includes(l.fonte) && (l.padrao === null || (PADROES as readonly string[]).includes(l.padrao)))
    .map((l) => ({
      id: l.id,
      empresaId: l.empresa_id,
      chave: l.chave,
      padrao: l.padrao as Padrao | null,
      fonte: l.fonte as FonteMapeamento,
      codigo: l.codigo,
      fatorConversao: String(l.fator_conversao),
    }));
}

/** Agrupa os padrões consecutivos que resolvem para a mesma linha. */
export function resumirMapeamento(chave: string, lista: readonly MapeamentoExibicao[]): ResumoChave {
  const daChave = lista.filter((m) => m.chave === chave);
  const grupos: GrupoEfetivo[] = [];
  for (const p of PADROES) {
    const linha = resolverMapeamento(chave, p, daChave) as MapeamentoExibicao | null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.linha?.id === linha?.id) {
      grupos[grupos.length - 1] = { ...ultimo, padroes: [...ultimo.padroes, p] };
    } else {
      grupos.push({ padroes: [p], linha });
    }
  }
  const mapeados = grupos.filter((g) => g.linha).reduce((n, g) => n + g.padroes.length, 0);
  const situacao: SituacaoMapeamento = mapeados === PADROES.length ? "mapeado" : mapeados === 0 ? "nao_mapeado" : "parcial";
  return { grupos, situacao };
}

/** Quantas chaves do catálogo têm composição em todos os padrões. */
export function contarMapeadas(chaves: readonly string[], lista: readonly MapeamentoExibicao[]): number {
  return chaves.filter((c) => resumirMapeamento(c, lista).situacao === "mapeado").length;
}

/** Diferença de unidade sem fator de conversão (provável erro de mapeamento). */
export function alertaUnidade(unidadeCatalogo: string, unidadeComposicao: string | null | undefined, fator: string): string | null {
  if (!unidadeComposicao) return null;
  const norm = (u: string) => u.trim().toLowerCase().replace("2", "²").replace("3", "³");
  if (norm(unidadeCatalogo) === norm(unidadeComposicao)) return null;
  if (!new D(fator).eq(1)) return null;
  return `Unidades diferentes (${unidadeCatalogo} → ${unidadeComposicao}) com fator 1: confira o fator de conversão.`;
}

/** Texto curto dos padrões de um grupo. */
export function rotuloPadroes(padroes: readonly Padrao[]): string {
  if (padroes.length === PADROES.length) return "Todos os padrões";
  return padroes.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
}
