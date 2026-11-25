import Decimal from "decimal.js";

/** Instância isolada do Decimal para o motor: 40 dígitos, arredondamento comercial (meio para cima). */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export type ValorDecimal = Dec | string | number;

export const ZERO = new D(0);

export function dec(valor: ValorDecimal | null | undefined): Dec {
  if (valor === null || valor === undefined || valor === "") return ZERO;
  return new D(valor);
}

export function decOuNull(valor: ValorDecimal | null | undefined): Dec | null {
  if (valor === null || valor === undefined || valor === "") return null;
  return new D(valor);
}

/** Dinheiro: total de item com 2 casas. */
export function arred2(v: Dec): Dec {
  return v.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Preço unitário / quantidades: 4 casas. */
export function arred4(v: Dec): Dec {
  return v.toDecimalPlaces(4, D.ROUND_HALF_UP);
}

export function truncar2(v: Dec): Dec {
  return v.toDecimalPlaces(2, D.ROUND_DOWN);
}

export function soma(valores: readonly Dec[]): Dec {
  return valores.reduce((acc, v) => acc.plus(v), ZERO);
}

/** Formata em pt-BR: 1234.5 → "1.234,50". */
export function formatarBr(v: Dec | null | undefined, casas = 2): string {
  if (!v) return "—";
  const [int, frac] = v.toFixed(casas).split(".");
  const neg = (int ?? "").startsWith("-");
  const digitos = (int ?? "0").replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${digitos}${casas > 0 ? `,${frac}` : ""}`;
}
