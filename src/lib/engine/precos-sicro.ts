/**
 * Motor de preços SICRO (função pura). Regras conferidas no analítico do SICRO PI 07/2026:
 *  custo horário   = Σ equip. qtd × (util_op × CHP + util_improd × CHI) + Σ mão de obra qtd × custo/h
 *  custo execução  = custo horário / produção da equipe
 *  custo FIC       = FIC × (Σ equip. qtd × CHI + custo horário de mão de obra) / produção
 *                    (o prompt previa execução × FIC; o relatório oficial usa o custo improdutivo:
 *                     3.793 de 3.794 composições conferem)
 *  custo unitário  = execução + FIC + C (materiais) + D (auxiliares) + E (tempo fixo)
 *                    + F (qtd × Σ DMT_via × custo da composição de transporte da via)
 * Totais de linha com 4 casas; custo final com 2 casas.
 */
import { D, ZERO, arred2, arred4, decOuNull, soma, type Dec, type ValorDecimal } from "./decimal";
import { CicloComposicaoError } from "./precos-sinapi";

export type GrupoSicro = "A" | "B" | "C" | "D" | "E" | "F";

export interface ItemSicro {
  grupo: GrupoSicro;
  codigo: string;
  coeficiente: ValorDecimal;
  utilizacaoOperativa?: ValorDecimal | null;
  utilizacaoImprodutiva?: ValorDecimal | null;
  /** grupo F: composições de transporte por tipo de via (leito natural, revestimento primário, pavimentada) */
  vias?: { ln?: string; rp?: string; p?: string } | null;
}

export interface ComposicaoSicro {
  producao: ValorDecimal;
  fic: ValorDecimal | null;
  itens: readonly ItemSicro[];
}

export interface BaseCustoSicro {
  equipamentos: ReadonlyMap<string, { chp: ValorDecimal; chi: ValorDecimal }>;
  /** mão de obra (custo/h) e materiais (preço unitário) */
  insumos: ReadonlyMap<string, ValorDecimal | null>;
  composicoes: ReadonlyMap<string, ComposicaoSicro>;
}

export interface DmtObra {
  ln: ValorDecimal;
  rp: ValorDecimal;
  p: ValorDecimal;
}

export interface DetalheSicro {
  custoHorarioEquipamentos: Dec;
  custoHorarioMaoObra: Dec;
  custoExecucao: Dec;
  custoFic: Dec;
  custoMateriais: Dec;
  custoAtividadesAuxiliares: Dec;
  custoTempoFixo: Dec;
  custoTransporte: Dec;
  custoUnitario: Dec;
}

export interface CalculadoraSicro {
  custo(codigo: string): Dec | null;
  detalhe(codigo: string): DetalheSicro | null;
  faltantes(codigo: string): string[];
}

interface Resultado {
  detalhe: DetalheSicro | null;
  faltantes: string[];
}

const SEM_DMT: DmtObra = { ln: 0, rp: 0, p: 0 };

export function criarCalculadoraSicro(base: BaseCustoSicro, opcoes: { dmt?: DmtObra } = {}): CalculadoraSicro {
  const dmt = opcoes.dmt ?? SEM_DMT;
  const memo = new Map<string, Resultado>();

  function custoComp(codigo: string, pilha: string[], falt: string[]): Dec | null {
    const r = calcular(codigo, pilha);
    falt.push(...r.faltantes);
    return r.detalhe?.custoUnitario ?? null;
  }

  function precoInsumo(codigo: string, falt: string[]): Dec | null {
    if (!base.insumos.has(codigo)) {
      falt.push(`insumo ${codigo} não encontrado`);
      return null;
    }
    const p = decOuNull(base.insumos.get(codigo));
    if (!p) falt.push(`insumo ${codigo} sem preço`);
    return p;
  }

  function linhaEquip(it: ItemSicro, falt: string[]): { total: Dec; improdutivo: Dec } {
    const eq = base.equipamentos.get(it.codigo);
    if (!eq) {
      falt.push(`equipamento ${it.codigo} sem custo horário`);
      return { total: ZERO, improdutivo: ZERO };
    }
    const q = new D(it.coeficiente);
    const op = new D(it.utilizacaoOperativa ?? 0);
    const imp = new D(it.utilizacaoImprodutiva ?? 0);
    const total = arred4(q.times(op.times(eq.chp).plus(imp.times(eq.chi))));
    return { total, improdutivo: q.times(eq.chi) };
  }

  function transporte(it: ItemSicro, pilha: string[], falt: string[]): Dec {
    const q = new D(it.coeficiente);
    const vias: [keyof DmtObra, string | undefined][] = [["ln", it.vias?.ln], ["rp", it.vias?.rp], ["p", it.vias?.p]];
    return soma(vias.map(([via, comp]) => {
      const dist = new D(dmt[via]);
      if (dist.isZero() || !comp) return ZERO;
      const c = custoComp(comp, pilha, falt);
      return c ? arred4(q.times(dist).times(c)) : ZERO;
    }));
  }

  function calcular(codigo: string, pilha: string[]): Resultado {
    const salvo = memo.get(codigo);
    if (salvo) return salvo;
    if (pilha.includes(codigo)) throw new CicloComposicaoError([...pilha.slice(pilha.indexOf(codigo)), codigo]);
    const comp = base.composicoes.get(codigo);
    if (!comp) return { detalhe: null, faltantes: [`composição ${codigo} não encontrada`] };
    const proxima = [...pilha, codigo];
    const falt: string[] = [];
    const g = (grupo: GrupoSicro) => comp.itens.filter((i) => i.grupo === grupo);

    const equips = g("A").map((it) => linhaEquip(it, falt));
    const custoHorarioEquipamentos = soma(equips.map((e) => e.total));
    const improdutivo = soma(equips.map((e) => e.improdutivo));
    const custoHorarioMaoObra = soma(g("B").map((it) => {
      const p = precoInsumo(it.codigo, falt);
      return p ? arred4(new D(it.coeficiente).times(p)) : ZERO;
    }));
    const producao = new D(comp.producao);
    const prod = producao.isZero() ? new D(1) : producao;
    const custoExecucao = arred4(custoHorarioEquipamentos.plus(custoHorarioMaoObra).div(prod));
    const fic = decOuNull(comp.fic);
    const custoFic = fic ? arred4(fic.times(improdutivo.plus(custoHorarioMaoObra)).div(prod)) : ZERO;
    const custoMateriais = soma(g("C").map((it) => {
      const p = precoInsumo(it.codigo, falt);
      return p ? arred4(new D(it.coeficiente).times(p)) : ZERO;
    }));
    const porComp = (it: ItemSicro): Dec => {
      const c = custoComp(it.codigo, proxima, falt);
      return c ? arred4(new D(it.coeficiente).times(c)) : ZERO;
    };
    const custoAtividadesAuxiliares = soma(g("D").map(porComp));
    const custoTempoFixo = soma(g("E").map(porComp));
    const custoTransporte = soma(g("F").map((it) => transporte(it, proxima, falt)));
    const custoUnitario = arred2(soma([
      custoExecucao, custoFic, custoMateriais, custoAtividadesAuxiliares, custoTempoFixo, custoTransporte,
    ]));
    const faltantes = [...new Set(falt)];
    const res: Resultado = {
      detalhe: faltantes.length ? null : {
        custoHorarioEquipamentos, custoHorarioMaoObra, custoExecucao, custoFic, custoMateriais,
        custoAtividadesAuxiliares, custoTempoFixo, custoTransporte, custoUnitario,
      },
      faltantes,
    };
    memo.set(codigo, res);
    return res;
  }

  return {
    custo: (c) => calcular(c, []).detalhe?.custoUnitario ?? null,
    detalhe: (c) => calcular(c, []).detalhe,
    faltantes: (c) => calcular(c, []).faltantes,
  };
}
