/** Converte uma base lida das planilhas oficiais (ou do banco) para a entrada dos motores de preço. */
import type { ItemSinapi, BaseCustoSinapi } from "../engine/precos-sinapi";
import type { BaseCustoSicro, ComposicaoSicro, ItemSicro } from "../engine/precos-sicro";
import type { BaseImportada } from "./parsers/tipos";

export function baseParaMotorSinapi(base: Pick<BaseImportada, "insumos" | "itens">): BaseCustoSinapi {
  const composicoes = new Map<string, ItemSinapi[]>();
  for (const it of base.itens) {
    const lista = composicoes.get(it.composicaoCodigo) ?? [];
    lista.push({ tipo: it.tipoItem, codigo: it.itemCodigo, coeficiente: it.coeficiente });
    composicoes.set(it.composicaoCodigo, lista);
  }
  return { insumos: new Map(base.insumos.map((i) => [i.codigo, i.preco])), composicoes };
}

export function baseParaMotorSicro(
  base: Pick<BaseImportada, "insumos" | "itens" | "equipamentos" | "composicoes">,
): BaseCustoSicro {
  const itens = new Map<string, ItemSicro[]>();
  for (const it of base.itens) {
    if (!it.grupoSicro) continue;
    const lista = itens.get(it.composicaoCodigo) ?? [];
    lista.push({
      grupo: it.grupoSicro, codigo: it.itemCodigo, coeficiente: it.coeficiente,
      utilizacaoOperativa: it.utilizacaoOperativa, utilizacaoImprodutiva: it.utilizacaoImprodutiva,
      vias: it.grupoSicro === "F" && it.extra ? { ln: it.extra.ln, rp: it.extra.rp, p: it.extra.p } : null,
    });
    itens.set(it.composicaoCodigo, lista);
  }
  const composicoes = new Map<string, ComposicaoSicro>();
  for (const c of base.composicoes) {
    composicoes.set(c.codigo, { producao: c.producaoEquipe ?? "1", fic: c.fic, itens: itens.get(c.codigo) ?? [] });
  }
  return {
    equipamentos: new Map(base.equipamentos.map((e) => [e.codigo, { chp: e.chp, chi: e.chi }])),
    insumos: new Map(base.insumos.map((i) => [i.codigo, i.preco])),
    composicoes,
  };
}
