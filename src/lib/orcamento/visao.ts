/**
 * Transformações puras dos dados carregados do orçamento para as abas (planilha, composições,
 * curva ABC e cronograma). Saída serializável (texto decimal) para componentes de cliente.
 */
import { nomeEtapa } from "../engine/catalogo";
import { curvaAbc } from "../engine/curva-abc";
import { D, ZERO, arred2, soma, type Dec } from "../engine/decimal";
import type { ResultadoOrcamento } from "../engine/orcamento";
import type { ItemDb } from "./carregar";

export interface LinhaPlanilha {
  id: string;
  numero: string;
  etapa: string;
  nomeEtapa: string;
  ambienteId: string | null;
  ambiente: string | null;
  fonte: string | null;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade: string;
  quantidadeCalculada: string | null;
  memoria: string | null;
  custoUnitario: string | null;
  precoUnitario: string | null;
  total: string;
  editado: boolean;
  alerta: string | null;
  chave: string | null;
}

const txt = (v: Dec | null): string | null => (v === null ? null : v.toFixed());

export function linhasPlanilha(itens: readonly ItemDb[], resultado: ResultadoOrcamento, ambientes: ReadonlyMap<string, string>): LinhaPlanilha[] {
  const calc = new Map(resultado.itens.map((i) => [i.id, i]));
  return itens.map((i) => {
    const c = calc.get(i.id);
    return {
      id: i.id, numero: i.numero ?? "", etapa: i.etapa, nomeEtapa: nomeEtapa(i.etapa),
      ambienteId: i.ambiente_id, ambiente: i.ambiente_id ? ambientes.get(i.ambiente_id) ?? null : null,
      fonte: i.fonte, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade,
      quantidade: i.quantidade, quantidadeCalculada: i.quantidade_calculada, memoria: i.memoria_calculo,
      custoUnitario: txt(c?.custoUnitario ?? null), precoUnitario: txt(c?.precoUnitario ?? null),
      total: (c?.total ?? ZERO).toFixed(2), editado: i.editado_manual, alerta: i.alerta, chave: i.chave_servico,
    };
  });
}

export interface ComposicaoUsada {
  fonte: string;
  codigo: string;
  descricao: string;
  unidade: string;
  custoUnitario: string | null;
  itens: number;
  total: string;
}

/** Composições distintas usadas no orçamento (fonte + código), com o total que representam. */
export function composicoesUsadas(linhas: readonly LinhaPlanilha[]): ComposicaoUsada[] {
  const mapa = new Map<string, ComposicaoUsada & { soma: Dec }>();
  for (const l of linhas) {
    if (!l.fonte || !l.codigo) continue;
    const k = `${l.fonte}|${l.codigo}`;
    const a = mapa.get(k);
    if (a) mapa.set(k, { ...a, itens: a.itens + 1, soma: a.soma.plus(l.total) });
    else mapa.set(k, { fonte: l.fonte, codigo: l.codigo, descricao: l.descricao, unidade: l.unidade, custoUnitario: l.custoUnitario, itens: 1, total: "0", soma: new D(l.total) });
  }
  return [...mapa.values()]
    .map(({ soma: s, ...c }) => ({ ...c, total: s.toFixed(2) }))
    .sort((a, b) => new D(b.total).comparedTo(a.total));
}

export interface LinhaAbcVisao {
  id: string;
  descricao: string;
  total: string;
  percentual: string;
  acumulado: string;
  classe: "A" | "B" | "C";
}

export function abcDoOrcamento(linhas: readonly LinhaPlanilha[]): LinhaAbcVisao[] {
  return curvaAbc(linhas.map((l) => ({ id: l.id, descricao: `${l.descricao}${l.ambiente ? ` — ${l.ambiente}` : ""}`, total: new D(l.total) })))
    .map((l) => ({
      id: l.id, descricao: l.descricao, total: l.total.toFixed(2), classe: l.classe,
      percentual: l.percentual.times(100).toFixed(2), acumulado: l.percentualAcumulado.times(100).toFixed(2),
    }));
}

export interface CronogramaVisao {
  meses: number;
  linhas: Array<{ etapa: string; nome: string; total: string; valores: string[]; percentuais: string[] }>;
  totaisMes: string[];
  acumulado: string[];
  percentualAcumulado: string[];
  total: string;
}

/**
 * Valores mensais = total da etapa × percentual gravado; o último mês com valor absorve o
 * resíduo de arredondamento para que a soma da linha feche com o total da etapa.
 */
export function cronogramaVisao(
  cronograma: ReadonlyArray<{ etapa: string; mes: number; percentual: string }>,
  totaisEtapa: ResultadoOrcamento["totaisEtapa"],
): CronogramaVisao {
  const meses = cronograma.reduce((m, c) => Math.max(m, c.mes), 0);
  const linhas = totaisEtapa.filter((t) => t.total.gt(0)).map((t) => {
    const pct = Array.from({ length: meses }, (_, m) => new D(cronograma.find((c) => c.etapa === t.etapa && c.mes === m + 1)?.percentual ?? 0));
    const valores = pct.map((p) => arred2(t.total.times(p).div(100)));
    const ultimo = pct.map((p) => p.gt(0)).lastIndexOf(true);
    if (ultimo >= 0) valores[ultimo] = valores[ultimo]!.plus(t.total.minus(soma(valores)));
    return { etapa: t.etapa, nome: nomeEtapa(t.etapa), total: t.total.toFixed(2), valores, percentuais: pct.map((p) => p.toFixed(3)) };
  });
  const totaisMes = Array.from({ length: meses }, (_, m) => soma(linhas.map((l) => l.valores[m] ?? ZERO)));
  const total = soma(totaisMes);
  let acc: Dec = ZERO;
  const acumulado = totaisMes.map((v) => (acc = acc.plus(v)));
  return {
    meses,
    linhas: linhas.map((l) => ({ ...l, valores: l.valores.map((v) => v.toFixed(2)) })),
    totaisMes: totaisMes.map((v) => v.toFixed(2)),
    acumulado: acumulado.map((v) => v.toFixed(2)),
    percentualAcumulado: acumulado.map((v) => (total.isZero() ? "0.00" : v.div(total).times(100).toFixed(2))),
    total: total.toFixed(2),
  };
}
