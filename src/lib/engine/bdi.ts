/**
 * BDI pela fórmula do TCU (Acórdão 2622/2013 – Plenário):
 * BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − I)) − 1
 * Parâmetros em fração (0,04 = 4%). As faixas de referência vêm de tabela editável (seed).
 */
import { D, type Dec, type ValorDecimal } from "./decimal";

export interface ParametrosBdi {
  ac: ValorDecimal;
  s: ValorDecimal;
  r: ValorDecimal;
  g: ValorDecimal;
  df: ValorDecimal;
  l: ValorDecimal;
  i: ValorDecimal;
}

export type ComponenteBdi = keyof ParametrosBdi | "s_g" | "bdi";

export interface FaixaBdi {
  componente: ComponenteBdi;
  minimo: ValorDecimal;
  medio: ValorDecimal;
  maximo: ValorDecimal;
}

export interface AlertaBdi {
  componente: ComponenteBdi;
  valor: Dec;
  mensagem: string;
}

export function calcularBdi(p: ParametrosBdi): Dec {
  const i = new D(p.i);
  if (i.gte(1)) throw new Error("Tributos (I) devem ser menores que 100%.");
  const base = new D(1).plus(p.ac).plus(p.s).plus(p.r).plus(p.g);
  return base.times(new D(1).plus(p.df)).times(new D(1).plus(p.l)).div(new D(1).minus(i)).minus(1);
}

function valorDoComponente(p: ParametrosBdi, c: ComponenteBdi): Dec {
  if (c === "bdi") return calcularBdi(p);
  if (c === "s_g") return new D(p.s).plus(p.g);
  return new D(p[c]);
}

const pct = (v: Dec): string => `${v.times(100).toFixed(2).replace(".", ",")}%`;

export function verificarFaixasBdi(p: ParametrosBdi, faixas: readonly FaixaBdi[]): AlertaBdi[] {
  const alertas: AlertaBdi[] = [];
  for (const f of faixas) {
    const valor = valorDoComponente(p, f.componente);
    const nome = f.componente.toUpperCase().replace("_", "+");
    if (valor.lt(f.minimo)) {
      alertas.push({ componente: f.componente, valor, mensagem: `${nome} ${pct(valor)} abaixo da faixa de referência (${pct(new D(f.minimo))} a ${pct(new D(f.maximo))}).` });
    } else if (valor.gt(f.maximo)) {
      alertas.push({ componente: f.componente, valor, mensagem: `${nome} ${pct(valor)} acima da faixa de referência (${pct(new D(f.minimo))} a ${pct(new D(f.maximo))}).` });
    }
  }
  return alertas;
}

/** Preço com BDI, arredondado em 2 casas no total do item. */
export function aplicarBdi(custo: ValorDecimal, bdi: ValorDecimal): Dec {
  return new D(custo).times(new D(1).plus(bdi));
}
