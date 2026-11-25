/**
 * Precificação (seção 8): cada item do motor de quantitativos recebe fonte + código pelo mapeamento
 * editável, a quantidade é convertida pelo fator de conversão e o custo vem da base oficial.
 * Item sem mapeamento ou sem custo fica com custo null + alerta ("sem composição") e bloqueia aprovação.
 */
import { servicoDoCatalogo, type TipoBdi } from "../engine/catalogo";
import { D, arred4, formatarBr } from "../engine/decimal";
import type { Padrao } from "../engine/entrada.schema";
import type { ItemQuantitativo } from "../engine/quantitativos";
import type { FonteCusto } from "./fechamento";

export type FonteMapeamento = "SINAPI" | "SICRO" | "PROPRIA";

export interface Mapeamento {
  empresaId: string | null;
  chave: string;
  padrao: Padrao | null;
  fonte: FonteMapeamento;
  codigo: string;
  fatorConversao: string;
}

/** Ordem de preferência: empresa+padrão, empresa, global+padrão, global; dentro dela, a fonte. */
export function resolverMapeamento(chave: string, padrao: Padrao, lista: readonly Mapeamento[]): Mapeamento | null {
  const preferenciaFonte: FonteMapeamento[] = chave.includes("SICRO") ? ["SICRO", "PROPRIA", "SINAPI"] : ["PROPRIA", "SINAPI", "SICRO"];
  const nivel = (m: Mapeamento): number => (m.empresaId !== null ? 0 : 2) + (m.padrao === padrao ? 0 : 1);
  const candidatos = lista.filter((m) => m.chave === chave && (m.padrao === null || m.padrao === padrao));
  candidatos.sort((a, b) => nivel(a) - nivel(b) || preferenciaFonte.indexOf(a.fonte) - preferenciaFonte.indexOf(b.fonte));
  return candidatos[0] ?? null;
}

export interface LinhaOrcamento {
  ordem: number;
  etapa: string;
  chaveServico: string;
  ambienteId: string | null;
  fonte: FonteMapeamento | null;
  codigo: string | null;
  descricao: string;
  unidade: string;
  /** quantidade do motor já convertida pelo fator (na unidade da composição) */
  quantidadeCalculada: string;
  /** quantidade usada (igual à calculada, salvo edição manual) */
  quantidade: string;
  fatorConversao: string;
  memoria: string;
  custoUnitario: string | null;
  bdiTipo: TipoBdi;
  percentual: boolean;
  editadoManual: boolean;
  alerta: string | null;
}

export interface EntradaPrecificacao {
  itens: readonly ItemQuantitativo[];
  padrao: Padrao;
  mapeamentos: readonly Mapeamento[];
  fontes: Partial<Record<FonteMapeamento, FonteCusto>>;
  /** quantidades editadas à mão, por chaveLinha() */
  edicoesManuais?: ReadonlyMap<string, string>;
}

export const chaveLinha = (chaveServico: string, ambienteId: string | null): string => `${chaveServico}|${ambienteId ?? ""}`;

function precificarItem(it: ItemQuantitativo, ordem: number, e: EntradaPrecificacao): LinhaOrcamento {
  const cat = servicoDoCatalogo(it.chaveServico);
  const manual = e.edicoesManuais?.get(chaveLinha(it.chaveServico, it.ambienteId));
  const base = {
    ordem, etapa: it.etapa, chaveServico: it.chaveServico, ambienteId: it.ambienteId, bdiTipo: cat.bdi,
    editadoManual: manual !== undefined,
  };
  if (it.unidade === "%") {
    return {
      ...base, fonte: null, codigo: null, descricao: cat.descricao, unidade: "%", quantidadeCalculada: it.quantidade,
      quantidade: manual ?? it.quantidade, fatorConversao: "1", memoria: it.memoria, custoUnitario: null, percentual: true, alerta: null,
    };
  }
  const semCusto = (fonte: FonteMapeamento | null, codigo: string | null, alerta: string, fator = "1"): LinhaOrcamento => ({
    ...base, fonte, codigo, descricao: cat.descricao, unidade: it.unidade, quantidadeCalculada: it.quantidade,
    quantidade: manual ?? it.quantidade, fatorConversao: fator, memoria: it.memoria, custoUnitario: null, percentual: false, alerta,
  });

  const m = resolverMapeamento(it.chaveServico, e.padrao, e.mapeamentos);
  if (!m) return semCusto(null, null, "Sem composição mapeada para este serviço (Configurações → Mapeamento).");
  const fonte = e.fontes[m.fonte];
  if (!fonte) return semCusto(m.fonte, m.codigo, `Nenhuma base ${m.fonte} selecionada para este orçamento.`, m.fatorConversao);
  const desc = fonte.descricao(m.codigo);
  if (!desc) return semCusto(m.fonte, m.codigo, `Composição ${m.fonte} ${m.codigo} não encontrada em ${fonte.rotulo}.`, m.fatorConversao);

  const fator = new D(m.fatorConversao);
  const qtd = arred4(new D(it.quantidade).times(fator)).toFixed();
  const memoria = fator.eq(1) ? it.memoria : `${it.memoria} × fator ${formatarBr(fator, 4)} (${it.unidade} → ${desc.unidade})`;
  const { custo, faltantes } = fonte.custo(m.codigo);
  return {
    ...base, fonte: m.fonte, codigo: m.codigo, descricao: desc.descricao, unidade: desc.unidade || it.unidade,
    quantidadeCalculada: qtd, quantidade: manual ?? qtd, fatorConversao: m.fatorConversao, memoria,
    custoUnitario: custo ? arred4(custo).toFixed(4) : null, percentual: false,
    alerta: custo ? null : `Sem custo em ${fonte.rotulo}: ${faltantes.slice(0, 3).join("; ")}.`,
  };
}

export function precificarItens(e: EntradaPrecificacao): LinhaOrcamento[] {
  return e.itens.map((it, i) => precificarItem(it, i + 1, e));
}

/** Códigos que precisam ser buscados em cada base (para a RPC de fechamento). */
export function codigosNecessarios(
  itens: readonly ItemQuantitativo[], padrao: Padrao, mapeamentos: readonly Mapeamento[],
): Record<FonteMapeamento, string[]> {
  const out: Record<FonteMapeamento, Set<string>> = { SINAPI: new Set(), SICRO: new Set(), PROPRIA: new Set() };
  for (const it of itens) {
    const m = resolverMapeamento(it.chaveServico, padrao, mapeamentos);
    if (m) out[m.fonte].add(m.codigo);
  }
  return { SINAPI: [...out.SINAPI], SICRO: [...out.SICRO], PROPRIA: [...out.PROPRIA] };
}
