/**
 * Motor de preços SINAPI (função pura, sem banco).
 * custo = Σ (coeficiente × preço do insumo) + Σ (coeficiente × custo da composição auxiliar)
 * Regra oficial verificada na Fase 0: o total de cada linha é TRUNCADO em 2 casas
 * (reproduz 100% das composições com custo do SINAPI 10/2026 em PI, SP, AC e RS).
 */
import { D, ZERO, decOuNull, truncar2, type Dec, type ValorDecimal } from "./decimal";

export interface ItemSinapi {
  tipo: "INSUMO" | "COMPOSICAO";
  codigo: string;
  coeficiente: ValorDecimal;
}

export interface BaseCustoSinapi {
  /** preço do insumo; null = insumo existe mas sem preço na UF/mês */
  insumos: ReadonlyMap<string, ValorDecimal | null>;
  composicoes: ReadonlyMap<string, readonly ItemSinapi[]>;
}

export type RegraLinha = "truncar_2" | "exata";

export interface LinhaAnalitica {
  tipo: ItemSinapi["tipo"];
  codigo: string;
  coeficiente: Dec;
  precoUnitario: Dec | null;
  total: Dec | null;
}

export interface CalculadoraSinapi {
  custo(codigo: string): Dec | null;
  analitica(codigo: string): LinhaAnalitica[];
  faltantes(codigo: string): string[];
}

export class CicloComposicaoError extends Error {
  constructor(public readonly caminho: string[]) {
    super(`Ciclo entre composições: ${caminho.join(" → ")}`);
    this.name = "CicloComposicaoError";
  }
}

interface Resultado {
  custo: Dec | null;
  faltantes: string[];
}

export function criarCalculadoraSinapi(
  base: BaseCustoSinapi, opcoes: { regraLinha?: RegraLinha } = {},
): CalculadoraSinapi {
  const regra = opcoes.regraLinha ?? "truncar_2";
  const memo = new Map<string, Resultado>();
  const totalLinha = (coef: Dec, preco: Dec): Dec => {
    const t = coef.times(preco);
    return regra === "truncar_2" ? truncar2(t) : t;
  };

  function precoItem(item: ItemSinapi, pilha: string[]): Resultado {
    if (item.tipo === "COMPOSICAO") return calcular(item.codigo, pilha);
    if (!base.insumos.has(item.codigo)) return { custo: null, faltantes: [`insumo ${item.codigo} não encontrado`] };
    const p = decOuNull(base.insumos.get(item.codigo));
    return p ? { custo: p, faltantes: [] } : { custo: null, faltantes: [`insumo ${item.codigo} sem preço`] };
  }

  function calcular(codigo: string, pilha: string[]): Resultado {
    const salvo = memo.get(codigo);
    if (salvo) return salvo;
    if (pilha.includes(codigo)) throw new CicloComposicaoError([...pilha.slice(pilha.indexOf(codigo)), codigo]);
    const itens = base.composicoes.get(codigo);
    if (!itens) return { custo: null, faltantes: [`composição ${codigo} não encontrada`] };
    const proxima = [...pilha, codigo];
    let total: Dec = ZERO;
    const faltantes: string[] = [];
    for (const item of itens) {
      const r = precoItem(item, proxima);
      if (r.custo === null) faltantes.push(...r.faltantes);
      else total = total.plus(totalLinha(new D(item.coeficiente), r.custo));
    }
    const res: Resultado = { custo: faltantes.length ? null : total, faltantes: [...new Set(faltantes)] };
    memo.set(codigo, res);
    return res;
  }

  return {
    custo: (codigo) => calcular(codigo, []).custo,
    faltantes: (codigo) => calcular(codigo, []).faltantes,
    analitica(codigo) {
      return (base.composicoes.get(codigo) ?? []).map((item) => {
        const coef = new D(item.coeficiente);
        const p = precoItem(item, [codigo]).custo;
        return { tipo: item.tipo, codigo: item.codigo, coeficiente: coef, precoUnitario: p, total: p ? totalLinha(coef, p) : null };
      });
    },
  };
}
