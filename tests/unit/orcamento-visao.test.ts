import { describe, expect, it } from "vitest";
import { D } from "../../src/lib/engine/decimal";
import { calcularOrcamento } from "../../src/lib/engine/orcamento";
import type { ItemDb } from "../../src/lib/orcamento/carregar";
import { abcDoOrcamento, composicoesUsadas, cronogramaVisao, linhasPlanilha } from "../../src/lib/orcamento/visao";

const item = (id: string, over: Partial<ItemDb>): ItemDb => ({
  id, etapa: "alvenaria", numero: "5.1", chave_servico: "ALVENARIA", ambiente_id: null, fonte: "SINAPI", codigo: "C1",
  descricao: "Alvenaria", unidade: "m²", quantidade: "10", quantidade_calculada: "10", memoria_calculo: "m", fator_conversao: "1",
  custo_unitario: "50", editado_manual: false, bdi_tipo: "servico", alerta: null, ordem: 1, ...over,
});

const itens = [
  item("a", {}),
  item("b", { codigo: "C1", quantidade: "2", ambiente_id: "amb1", ordem: 2 }),
  item("c", { etapa: "pintura", codigo: "C2", descricao: "Pintura", custo_unitario: "10", ordem: 3 }),
  item("d", { etapa: "pintura", fonte: null, codigo: null, descricao: "Sem mapa", custo_unitario: null, ordem: 4 }),
];
const resultado = calcularOrcamento(
  itens.map((i) => ({ id: i.id, etapa: i.etapa, quantidade: i.quantidade, custoUnitario: i.custo_unitario, bdiTipo: "servico" as const })),
  { bdiServico: new D("0.2"), bdiMaterial: new D(0) },
);

describe("visão do orçamento", () => {
  it("monta as linhas da planilha com preço com BDI, total e nome do ambiente", () => {
    const linhas = linhasPlanilha(itens, resultado, new Map([["amb1", "Sala"]]));
    expect(linhas[0]).toMatchObject({ precoUnitario: "60", total: "600.00", nomeEtapa: "Alvenaria e vedação" });
    expect(linhas[1]!.ambiente).toBe("Sala");
    expect(linhas[3]).toMatchObject({ custoUnitario: null, total: "0.00" });
  });

  it("agrupa composições distintas por fonte e código, ordenadas pelo total", () => {
    const c = composicoesUsadas(linhasPlanilha(itens, resultado, new Map()));
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ codigo: "C1", itens: 2, total: "720.00" });
    expect(c[1]).toMatchObject({ codigo: "C2", total: "120.00" });
  });

  it("classifica a curva ABC em percentuais", () => {
    const abc = abcDoOrcamento(linhasPlanilha(itens, resultado, new Map()));
    expect(abc[0]).toMatchObject({ id: "a", classe: "A" });
    expect(abc.at(-1)!.acumulado).toBe("100.00");
  });

  it("distribui o cronograma e fecha a soma de cada etapa com o total (resíduo no último mês)", () => {
    const totais = [{ etapa: "alvenaria", custo: new D(100), total: new D("100.00") }];
    const v = cronogramaVisao([
      { etapa: "alvenaria", mes: 1, percentual: "33.333" },
      { etapa: "alvenaria", mes: 2, percentual: "33.333" },
      { etapa: "alvenaria", mes: 3, percentual: "33.334" },
    ], totais);
    expect(v.meses).toBe(3);
    expect(v.linhas[0]!.valores).toEqual(["33.33", "33.33", "33.34"]);
    expect(v.percentualAcumulado.at(-1)).toBe("100.00");
    expect(v.total).toBe("100.00");
  });

  it("cronograma vazio não quebra", () => {
    expect(cronogramaVisao([], []).meses).toBe(0);
  });
});
