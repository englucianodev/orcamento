/** Curva ABC dos itens (ou insumos) do orçamento. Limites de classe editáveis. */
import { ZERO, soma, type Dec } from "./decimal";

export interface ItemAbc {
  id: string;
  descricao: string;
  total: Dec;
}

export interface LinhaAbc extends ItemAbc {
  percentual: Dec;
  percentualAcumulado: Dec;
  classe: "A" | "B" | "C";
}

export function curvaAbc(itens: readonly ItemAbc[], limites = { a: 0.8, b: 0.95 }): LinhaAbc[] {
  const ordenados = [...itens].filter((i) => i.total.gt(0)).sort((x, y) => y.total.comparedTo(x.total));
  const total = soma(ordenados.map((i) => i.total));
  let acumulado: Dec = ZERO;
  return ordenados.map((i, pos) => {
    const percentual = total.isZero() ? ZERO : i.total.div(total);
    acumulado = acumulado.plus(percentual);
    const classe = pos === 0 || acumulado.lte(limites.a) ? "A" : acumulado.lte(limites.b) ? "B" : "C";
    return { ...i, percentual, percentualAcumulado: acumulado, classe };
  });
}
