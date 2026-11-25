/** Seções derivadas do orçamento: curva ABC, cronograma, memória por ambiente, BDI e encargos. */
import type { DadosOrcamento } from "../orcamento/carregar";
import { verificarFaixasBdi, type FaixaBdi } from "../engine/bdi";
import { ETAPAS, nomeEtapa } from "../engine/catalogo";
import { curvaAbc } from "../engine/curva-abc";
import { D, ZERO, arred2, decOuNull, soma, type Dec } from "../engine/decimal";
import { faixasDoBanco, parametrosBdi, taxaBdi, type LinhaBdi, type LinhaFaixa } from "../orcamento/config";
import {
  VAZIO, num, pct, type CronogramaRelatorio, type CurvaAbcRelatorio, type LinhaEncargos, type LinhaSintetica,
  type MemoriaAmbiente, type QuadroBdi,
} from "./tipos";

export function montarAbc(dados: DadosOrcamento, linhas: ReadonlyMap<string, LinhaSintetica>): CurvaAbcRelatorio {
  const itens = dados.resultado.itens.map((i) => ({ id: i.id, descricao: linhas.get(i.id)?.descricao ?? "—", total: i.total }));
  const abc = curvaAbc(itens);
  const total = soma(abc.map((l) => l.total));
  const classes = (["A", "B", "C"] as const).map((classe) => {
    const doGrupo = abc.filter((l) => l.classe === classe);
    const t = soma(doGrupo.map((l) => l.total));
    return { classe, itens: doGrupo.length, total: num(t), percentual: pct(total.isZero() ? ZERO : t.div(total)) };
  });
  return {
    linhas: abc.map((l, pos) => ({
      posicao: pos + 1, numero: linhas.get(l.id)?.numero ?? "—", fonteCodigo: linhas.get(l.id)?.fonteCodigo ?? "—",
      descricao: l.descricao, total: num(l.total), percentual: pct(l.percentual), acumulado: pct(l.percentualAcumulado), classe: l.classe,
    })),
    classes,
  };
}

/** Valores mensais de uma etapa: total × percentual / Σ percentuais; o último mês absorve o arredondamento. */
function distribuir(total: Dec, porMes: ReadonlyMap<number, Dec>, meses: number): Dec[] {
  const somaPct = soma([...porMes.values()]);
  const ultimo = Math.max(...[...porMes.entries()].filter(([, p]) => p.gt(0)).map(([m]) => m));
  const valores = Array.from({ length: meses }, (_, i) => {
    const p = porMes.get(i + 1);
    return p && p.gt(0) && i + 1 !== ultimo ? arred2(total.times(p).div(somaPct)) : ZERO;
  });
  valores[ultimo - 1] = total.minus(soma(valores));
  return valores;
}

export function montarCronograma(dados: DadosOrcamento): CronogramaRelatorio {
  const meses = dados.cronograma.reduce((m, c) => Math.max(m, c.mes), 0);
  const porEtapa = new Map<string, Map<number, Dec>>();
  for (const c of dados.cronograma) {
    const m = porEtapa.get(c.etapa) ?? new Map<number, Dec>();
    m.set(c.mes, (m.get(c.mes) ?? ZERO).plus(new D(c.percentual)));
    porEtapa.set(c.etapa, m);
  }
  const ordem = new Map<string, number>(ETAPAS.map((e, i) => [e.id, i]));
  const totais = [...dados.resultado.totaisEtapa].sort((a, b) => (ordem.get(a.etapa) ?? 99) - (ordem.get(b.etapa) ?? 99));
  const semDistribuicao: string[] = [];
  const linhas: Array<{ nome: string; total: Dec; valores: Dec[] }> = [];
  for (const t of totais) {
    if (t.total.isZero()) continue;
    const pcts = porEtapa.get(t.etapa);
    if (!pcts || meses === 0 || soma([...pcts.values()]).lte(0)) {
      semDistribuicao.push(nomeEtapa(t.etapa));
      continue;
    }
    linhas.push({ nome: nomeEtapa(t.etapa), total: t.total, valores: distribuir(t.total, pcts, meses) });
  }
  const totaisMes = Array.from({ length: meses }, (_, i) => soma(linhas.map((l) => l.valores[i] ?? ZERO)));
  const totalGeral = dados.resultado.total;
  let acc: Dec = ZERO;
  const acumulado = totaisMes.map((v) => (acc = acc.plus(v)));
  return {
    meses: Array.from({ length: meses }, (_, i) => `Mês ${i + 1}`),
    linhas: linhas.map((l) => ({ nome: l.nome, total: num(l.total), valores: l.valores.map((v) => num(v)) })),
    totaisMes: totaisMes.map((v) => num(v)),
    acumulado: acumulado.map((v) => num(v)),
    percentualAcumulado: acumulado.map((v) => (totalGeral.isZero() ? VAZIO : pct(v.div(totalGeral)))),
    total: num(soma(linhas.map((l) => l.total))),
    semDistribuicao,
  };
}

export function montarMemoria(dados: DadosOrcamento, linhas: ReadonlyMap<string, LinhaSintetica>): MemoriaAmbiente[] {
  const ambientes = dados.orcamento.entrada?.ambientes ?? [];
  const grupos = new Map<string | null, MemoriaAmbiente>(ambientes.map((a) => [a.id, { id: a.id, nome: a.nome, itens: [] }]));
  const geral: MemoriaAmbiente = { id: null, nome: "Obra (geral)", itens: [] };
  for (const item of dados.itens) {
    if (item.unidade === "%") continue;
    const id = item.ambiente_id;
    let grupo = id === null ? geral : grupos.get(id);
    if (!grupo) {
      grupo = { id, nome: "Ambiente não encontrado na entrada", itens: [] };
      grupos.set(id, grupo);
    }
    grupo.itens.push({
      numero: item.numero ?? "—", descricao: item.descricao, unidade: item.unidade,
      quantidade: linhas.get(item.id)?.quantidade ?? num(decOuNull(item.quantidade), 2, 4),
      memoria: item.memoria_calculo?.trim() || "—",
    });
  }
  return [...grupos.values(), geral].filter((g) => g.itens.length > 0);
}

const COMPONENTES: Array<{ chave: keyof ReturnType<typeof parametrosBdi>; sigla: string; nome: string; faixa: FaixaBdi["componente"] | null }> = [
  { chave: "ac", sigla: "AC", nome: "Administração central", faixa: "ac" },
  { chave: "s", sigla: "S", nome: "Seguros", faixa: null },
  { chave: "g", sigla: "G", nome: "Garantias", faixa: null },
  { chave: "r", sigla: "R", nome: "Riscos", faixa: "r" },
  { chave: "df", sigla: "DF", nome: "Despesas financeiras", faixa: "df" },
  { chave: "l", sigla: "L", nome: "Lucro", faixa: "l" },
  { chave: "i", sigla: "I", nome: "Tributos (PIS, COFINS, ISS, CPRB)", faixa: "i" },
];

function faixaTexto(faixas: readonly FaixaBdi[], componente: FaixaBdi["componente"] | null): string {
  const f = componente ? faixas.find((x) => x.componente === componente) : undefined;
  return f ? `${pct(new D(f.minimo)).br} a ${pct(new D(f.maximo)).br}` : "—";
}

function quadro(rotulo: string, b: LinhaBdi, linhasFaixa: readonly LinhaFaixa[] | undefined): QuadroBdi {
  const p = parametrosBdi(b);
  const faixas = linhasFaixa ? faixasDoBanco(linhasFaixa, b.tipo_obra) : [];
  const componentes = COMPONENTES.map((c) => ({
    sigla: c.sigla, nome: c.nome, valor: pct(new D(p[c.chave])), referencia: faixaTexto(faixas, c.faixa),
  }));
  const sg = { sigla: "S+G", nome: "Seguros + garantias", valor: pct(new D(p.s).plus(p.g)), referencia: faixaTexto(faixas, "s_g") };
  const alertas = linhasFaixa === undefined
    ? ["Faixas de referência do TCU indisponíveis: verificação não realizada."]
    : faixas.length === 0
      ? [`Sem faixas de referência cadastradas para o tipo de obra "${b.tipo_obra}".`]
      : verificarFaixasBdi(p, faixas).map((a) => a.mensagem);
  return {
    rotulo, nome: b.nome, tipoObra: b.tipo_obra, componentes: [...componentes, sg],
    taxa: pct(taxaBdi(b)), referenciaTaxa: faixaTexto(faixas, "bdi"), alertas,
  };
}

export function montarQuadrosBdi(dados: DadosOrcamento, faixas: readonly LinhaFaixa[] | undefined): QuadroBdi[] {
  const lista: QuadroBdi[] = [];
  if (dados.bdi.servico) lista.push(quadro("BDI de serviços", dados.bdi.servico, faixas));
  if (dados.bdi.material) lista.push(quadro("BDI de fornecimento de materiais", dados.bdi.material, faixas));
  return lista;
}

export interface LinhaEncargosDb {
  base_id: string;
  horista_pct: string | number | null;
  mensalista_pct: string | number | null;
}

/** Encargos sociais gravados em percentual (113,68 = 113,68%). */
export function montarEncargos(dados: DadosOrcamento, linhas: readonly LinhaEncargosDb[]): LinhaEncargos[] {
  const bases = [dados.bases.sinapi, dados.bases.sicro].filter((b) => b !== null);
  const fracao = (v: string | number | null) => {
    const d = decOuNull(v);
    return d ? d.div(100) : null;
  };
  return bases.flatMap((b) => {
    const e = linhas.find((l) => l.base_id === b.id);
    return e ? [{ base: b.rotulo, horista: pct(fracao(e.horista_pct)), mensalista: pct(fracao(e.mensalista_pct)) }] : [];
  });
}
