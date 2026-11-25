/** Validação por recálculo: aplica o motor puro sobre a base lida e compara com o preço publicado. */
import { D } from "../../src/lib/engine/decimal";
import { criarCalculadoraSinapi, type ItemSinapi } from "../../src/lib/engine/precos-sinapi";
import { criarCalculadoraSicro, type ComposicaoSicro } from "../../src/lib/engine/precos-sicro";
import type { BaseImportada } from "../../src/lib/importacao/parsers/tipos";

export interface ResultadoValidacao {
  comparadas: number;
  conferem: number;
  divergentes: { codigo: string; calculado: string; publicado: string }[];
  semCusto: number;
}

export function baseSinapiParaMotor(base: BaseImportada) {
  const composicoes = new Map<string, ItemSinapi[]>();
  for (const it of base.itens) {
    const lista = composicoes.get(it.composicaoCodigo) ?? [];
    lista.push({ tipo: it.tipoItem, codigo: it.itemCodigo, coeficiente: it.coeficiente });
    composicoes.set(it.composicaoCodigo, lista);
  }
  return { insumos: new Map(base.insumos.map((i) => [i.codigo, i.preco])), composicoes };
}

export function baseSicroParaMotor(base: BaseImportada) {
  const composicoes = new Map<string, ComposicaoSicro & { itens: ComposicaoSicro["itens"][number][] }>();
  for (const c of base.composicoes) composicoes.set(c.codigo, { producao: c.producaoEquipe ?? "1", fic: c.fic, itens: [] });
  for (const it of base.itens) {
    const comp = composicoes.get(it.composicaoCodigo);
    if (!comp || !it.grupoSicro) continue;
    comp.itens.push({
      grupo: it.grupoSicro, codigo: it.itemCodigo, coeficiente: it.coeficiente,
      utilizacaoOperativa: it.utilizacaoOperativa, utilizacaoImprodutiva: it.utilizacaoImprodutiva,
      vias: it.extra ? { ln: it.extra.ln, rp: it.extra.rp, p: it.extra.p } : null,
    });
  }
  return {
    equipamentos: new Map(base.equipamentos.map((e) => [e.codigo, { chp: e.chp, chi: e.chi }])),
    insumos: new Map(base.insumos.map((i) => [i.codigo, i.preco])),
    composicoes,
  };
}

export function validar(base: BaseImportada, tolerancia = "0.01"): ResultadoValidacao {
  const custo = base.fonte === "SINAPI"
    ? criarCalculadoraSinapi(baseSinapiParaMotor(base)).custo
    : criarCalculadoraSicro(baseSicroParaMotor(base)).custo;
  const res: ResultadoValidacao = { comparadas: 0, conferem: 0, divergentes: [], semCusto: 0 };
  for (const c of base.composicoes) {
    if (c.precoPublicado === null) continue;
    const v = custo(c.codigo);
    if (v === null) {
      res.semCusto += 1;
      continue;
    }
    res.comparadas += 1;
    if (v.minus(c.precoPublicado).abs().lte(new D(tolerancia))) res.conferem += 1;
    else res.divergentes.push({ codigo: c.codigo, calculado: v.toFixed(2), publicado: new D(c.precoPublicado).toFixed(2) });
  }
  return res;
}
