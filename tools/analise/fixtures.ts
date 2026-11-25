/**
 * Gera fixtures pequenas a partir das planilhas oficiais (dados públicos, sem dados de clientes):
 * fechamento (composição + auxiliares + insumos) de algumas composições, com o preço publicado.
 */
import type { BaseImportada } from "../../src/lib/importacao/parsers/tipos";
import type { Planilha } from "../../src/lib/importacao/xlsx-leitor";

export function fechamento(base: BaseImportada, codigos: string[]): BaseImportada {
  const comps = new Set<string>();
  const insumos = new Set<string>();
  const pilha = [...codigos];
  while (pilha.length) {
    const c = pilha.pop() as string;
    if (comps.has(c)) continue;
    comps.add(c);
    for (const it of base.itens.filter((i) => i.composicaoCodigo === c)) {
      if (it.tipoItem === "COMPOSICAO") {
        pilha.push(it.itemCodigo);
        for (const v of Object.values(it.extra ?? {})) if (/^\d{7}$/.test(v)) pilha.push(v);
      } else insumos.add(it.itemCodigo);
    }
  }
  return {
    ...base,
    insumos: base.insumos.filter((i) => insumos.has(i.codigo)),
    equipamentos: base.equipamentos.filter((e) => insumos.has(e.codigo)),
    composicoes: base.composicoes.filter((c) => comps.has(c.codigo)),
    itens: base.itens.filter((i) => comps.has(i.composicaoCodigo)),
    avisos: [],
  };
}

/** Recorte das primeiras N linhas de uma aba (para testar os parsers sem o arquivo inteiro). */
export function recorte(planilha: Planilha, linhas: number, maxColunas = 40): Planilha {
  return { nome: planilha.nome, linhas: planilha.linhas.slice(0, linhas).map((l) => l.slice(0, maxColunas)) };
}
