/**
 * Montagem do orçamento: preço unitário com BDI (4 casas) e total do item (2 casas).
 * Arredonda só o total de cada item; os totais de etapa e geral são somas exatas dos itens.
 * Itens percentuais (unidade "%") incidem sobre o custo direto dos demais itens.
 */
import type { Etapa, TipoBdi } from "./catalogo";
import { D, ZERO, arred2, arred4, decOuNull, soma, type Dec, type ValorDecimal } from "./decimal";

export interface ItemOrcamentoEntrada {
  id: string;
  etapa: Etapa | string;
  quantidade: ValorDecimal;
  /** custo unitário sem BDI (null = sem composição mapeada) */
  custoUnitario: ValorDecimal | null;
  bdiTipo: TipoBdi;
  percentual?: boolean;
}

export interface ItemOrcamentoCalculado {
  id: string;
  etapa: string;
  quantidade: Dec;
  custoUnitario: Dec | null;
  precoUnitario: Dec | null;
  custoTotal: Dec;
  total: Dec;
  semComposicao: boolean;
}

export interface OpcoesOrcamento {
  bdiServico: Dec;
  bdiMaterial: Dec;
  areaConstruida?: Dec | null;
  cubM2?: Dec | null;
}

export interface ResultadoOrcamento {
  itens: ItemOrcamentoCalculado[];
  totaisEtapa: Array<{ etapa: string; custo: Dec; total: Dec }>;
  custoDireto: Dec;
  total: Dec;
  custoM2: Dec | null;
  /** custo por m² / CUB − 1 (0,10 = 10% acima do CUB) */
  diferencaCub: Dec | null;
  semComposicao: string[];
  aprovavel: boolean;
}

const fatorBdi = (tipo: TipoBdi, o: OpcoesOrcamento): Dec => new D(1).plus(tipo === "material" ? o.bdiMaterial : o.bdiServico);

function calcularItem(i: ItemOrcamentoEntrada, o: OpcoesOrcamento): ItemOrcamentoCalculado {
  const quantidade = new D(i.quantidade);
  const custoUnitario = decOuNull(i.custoUnitario);
  if (custoUnitario === null) {
    return { id: i.id, etapa: i.etapa, quantidade, custoUnitario, precoUnitario: null, custoTotal: ZERO, total: ZERO, semComposicao: true };
  }
  const cu = arred4(custoUnitario);
  const precoUnitario = arred4(cu.times(fatorBdi(i.bdiTipo, o)));
  return {
    id: i.id, etapa: i.etapa, quantidade, custoUnitario: cu, precoUnitario,
    custoTotal: arred2(quantidade.times(cu)), total: arred2(quantidade.times(precoUnitario)), semComposicao: false,
  };
}

export function calcularOrcamento(itens: readonly ItemOrcamentoEntrada[], o: OpcoesOrcamento): ResultadoOrcamento {
  const normais = itens.filter((i) => !i.percentual).map((i) => calcularItem(i, o));
  const baseCusto = soma(normais.map((i) => i.custoTotal));
  const percentuais = itens.filter((i) => i.percentual).map((i): ItemOrcamentoCalculado => {
    const pct = new D(i.quantidade).div(100);
    const custo = baseCusto.times(pct);
    return {
      id: i.id, etapa: i.etapa, quantidade: new D(i.quantidade), custoUnitario: null, precoUnitario: null,
      custoTotal: arred2(custo), total: arred2(custo.times(fatorBdi(i.bdiTipo, o))), semComposicao: false,
    };
  });
  const ordem = new Map(itens.map((i, pos) => [i.id, pos]));
  const calculados = [...normais, ...percentuais].sort((a, b) => ordem.get(a.id)! - ordem.get(b.id)!);

  const etapas = new Map<string, { custo: Dec; total: Dec }>();
  for (const i of calculados) {
    const t = etapas.get(i.etapa) ?? { custo: ZERO, total: ZERO };
    etapas.set(i.etapa, { custo: t.custo.plus(i.custoTotal), total: t.total.plus(i.total) });
  }
  const total = soma(calculados.map((i) => i.total));
  const area = o.areaConstruida ?? null;
  const custoM2 = area && area.gt(0) ? total.div(area) : null;
  const cub = o.cubM2 ?? null;
  const semComposicao = calculados.filter((i) => i.semComposicao).map((i) => i.id);
  return {
    itens: calculados,
    totaisEtapa: [...etapas.entries()].map(([etapa, v]) => ({ etapa, ...v })),
    custoDireto: soma(calculados.map((i) => i.custoTotal)),
    total,
    custoM2: custoM2 ? arred2(custoM2) : null,
    diferencaCub: custoM2 && cub && cub.gt(0) ? custoM2.div(cub).minus(1) : null,
    semComposicao,
    aprovavel: semComposicao.length === 0,
  };
}
