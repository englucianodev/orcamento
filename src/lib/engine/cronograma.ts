/**
 * 7.3 Prazo e cronograma físico-financeiro (curva S).
 * Prazo = ⌈(base + área/100 × meses por 100 m²) × fator do padrão⌉; cada etapa é distribuída
 * uniformemente no intervalo [início, fim] da curva típica (frações do prazo).
 */
import type { Etapa } from "./catalogo";
import { D, ZERO, arred2, formatarBr, soma, type Dec } from "./decimal";
import type { Padrao } from "./entrada.schema";
import type { Indices } from "./indices";
import type { TabelasMotor } from "./tabelas";

export interface PrazoObra {
  meses: number;
  memoria: string;
}

export function prazoObra(area: Dec, padrao: Padrao, idx: Indices, tabelas: TabelasMotor): PrazoObra {
  const fator = new D(tabelas.fatorPrazo[padrao]);
  const bruto = idx.prazo_base_meses.plus(area.div(100).times(idx.prazo_meses_por_100m2)).times(fator);
  const meses = Math.max(1, bruto.ceil().toNumber());
  return {
    meses,
    memoria: `Prazo: (${formatarBr(idx.prazo_base_meses, 1)} + ${formatarBr(area)}/100 × ${formatarBr(idx.prazo_meses_por_100m2, 1)}) × ${formatarBr(fator)} = ${formatarBr(bruto)} → ${meses} meses`,
  };
}

export interface CustoEtapa {
  etapa: Etapa;
  total: Dec;
}

export interface LinhaCronograma {
  etapa: Etapa;
  total: Dec;
  /** fração do total da etapa em cada mês (soma = 1) */
  percentuais: Dec[];
  /** valor em cada mês, 2 casas; a soma é exatamente o total */
  valores: Dec[];
}

export interface Cronograma {
  meses: number;
  linhas: LinhaCronograma[];
  totaisMes: Dec[];
  acumulado: Dec[];
  percentualAcumulado: Dec[];
}

function fracoesPorMes(inicio: number, fim: number, meses: number): Dec[] {
  const a = new D(inicio).times(meses);
  const b = new D(fim).times(meses);
  const fracoes = Array.from({ length: meses }, () => ZERO);
  if (b.lte(a)) {
    const mes = Math.min(meses - 1, Math.max(0, a.floor().toNumber()));
    fracoes[mes] = new D(1);
    return fracoes;
  }
  const duracao = b.minus(a);
  return fracoes.map((_, m) => {
    const sobreposicao = D.min(b, m + 1).minus(D.max(a, m));
    return sobreposicao.gt(0) ? sobreposicao.div(duracao) : ZERO;
  });
}

export function distribuirCronograma(
  custos: readonly CustoEtapa[], meses: number, curva: TabelasMotor["curvaEtapas"],
): Cronograma {
  const n = Math.max(1, Math.floor(meses));
  const linhas = custos.filter((c) => c.total.gt(0)).map((c): LinhaCronograma => {
    const [inicio, fim] = curva[c.etapa];
    const percentuais = fracoesPorMes(inicio, fim, n);
    const valores = percentuais.map((p) => arred2(c.total.times(p)));
    // resíduo do arredondamento vai para o último mês com valor
    const residuo = c.total.minus(soma(valores));
    const ultimo = percentuais.reduce((u, p, i) => (p.gt(0) ? i : u), 0);
    valores[ultimo] = valores[ultimo]!.plus(residuo);
    return { etapa: c.etapa, total: c.total, percentuais, valores };
  });
  const totaisMes = Array.from({ length: n }, (_, m) => soma(linhas.map((l) => l.valores[m]!)));
  const acumulado: Dec[] = [];
  totaisMes.reduce((acc, v) => {
    const s = acc.plus(v);
    acumulado.push(s);
    return s;
  }, ZERO);
  const totalGeral = acumulado[n - 1] ?? ZERO;
  const percentualAcumulado = acumulado.map((v) => (totalGeral.isZero() ? ZERO : v.div(totalGeral)));
  return { meses: n, linhas, totaisMes, acumulado, percentualAcumulado };
}
