import { describe, expect, it } from "vitest";
import { distribuirCronograma, prazoObra } from "@/lib/engine/cronograma";
import { curvaAbc } from "@/lib/engine/curva-abc";
import { D } from "@/lib/engine/decimal";
import { criarIndices } from "@/lib/engine/indices";
import { calcularOrcamento, type ItemOrcamentoEntrada } from "@/lib/engine/orcamento";
import { TABELAS_PADRAO } from "@/lib/engine/tabelas";

describe("prazo e cronograma", () => {
  it("prazo = ⌈(base + área/100 × meses) × fator do padrão⌉", () => {
    const p = prazoObra(new D(150), "normal", criarIndices(), TABELAS_PADRAO);
    // (3 + 1,5 × 1,5) × 1 = 5,25 → 6
    expect(p.meses).toBe(6);
    expect(p.memoria).toContain("6 meses");
    expect(prazoObra(new D(150), "luxo", criarIndices(), TABELAS_PADRAO).meses).toBe(7);
  });

  it("distribui cada etapa pelos meses da curva e fecha o total", () => {
    const r = distribuirCronograma(
      [{ etapa: "administracao", total: new D("1000.00") }, { etapa: "fundacao", total: new D("300.00") }],
      10,
      TABELAS_PADRAO.curvaEtapas,
    );
    const adm = r.linhas.find((l) => l.etapa === "administracao")!;
    expect(adm.valores.map((v) => v.toFixed(2))).toEqual(Array(10).fill("100.00"));
    // fundação [0,05; 0,20] × 10 meses = meses 0,5 a 2,0 → 1/3 no mês 1 e 2/3 no mês 2
    const fund = r.linhas.find((l) => l.etapa === "fundacao")!;
    expect(fund.valores.slice(0, 3).map((v) => v.toFixed(2))).toEqual(["100.00", "200.00", "0.00"]);
    expect(r.totaisMes[0]?.toFixed(2)).toBe("200.00");
    expect(r.acumulado[9]?.toFixed(2)).toBe("1300.00");
    expect(r.percentualAcumulado[9]?.toFixed(4)).toBe("1.0000");
  });

  it("o arredondamento por mês preserva o total da etapa", () => {
    const r = distribuirCronograma([{ etapa: "administracao", total: new D("100.00") }], 3, TABELAS_PADRAO.curvaEtapas);
    const soma = r.linhas[0]!.valores.reduce((s, v) => s.plus(v), new D(0));
    expect(soma.toFixed(2)).toBe("100.00");
  });
});

describe("curva ABC", () => {
  it("ordena, acumula e classifica em A (80%), B (95%) e C", () => {
    const abc = curvaAbc([
      { id: "a", descricao: "A", total: new D(700) }, { id: "b", descricao: "B", total: new D(150) },
      { id: "c", descricao: "C", total: new D(100) }, { id: "d", descricao: "D", total: new D(50) },
    ]);
    expect(abc.map((l) => l.classe)).toEqual(["A", "B", "B", "C"]);
    expect(abc[1]?.percentualAcumulado.toFixed(4)).toBe("0.8500");
  });
});

describe("montagem do orçamento", () => {
  const itens: ItemOrcamentoEntrada[] = [
    { id: "1", etapa: "alvenaria", quantidade: "36.32", custoUnitario: "61.2345", bdiTipo: "servico" },
    { id: "2", etapa: "loucas_metais", quantidade: "3", custoUnitario: "250.5", bdiTipo: "material" },
    { id: "3", etapa: "pintura", quantidade: "10", custoUnitario: null, bdiTipo: "servico" },
    { id: "4", etapa: "administracao", quantidade: "2", custoUnitario: null, bdiTipo: "servico", percentual: true },
  ];
  const r = calcularOrcamento(itens, { bdiServico: new D("0.25"), bdiMaterial: new D("0.10"), areaConstruida: new D(100), cubM2: new D("20") });

  it("preço com BDI em 4 casas e total do item em 2 casas", () => {
    const i1 = r.itens.find((i) => i.id === "1")!;
    // 61,2345 × 1,25 = 76,543125 → 76,5431; × 36,32 = 2780,045... → 2780,05
    expect(i1.precoUnitario?.toFixed(4)).toBe("76.5431");
    expect(i1.total.toFixed(2)).toBe("2780.05");
    expect(i1.custoTotal.toFixed(2)).toBe("2224.04");
    const i2 = r.itens.find((i) => i.id === "2")!;
    expect(i2.total.toFixed(2)).toBe("826.65");
  });

  it("item sem composição fica com custo zero e bloqueia a aprovação", () => {
    expect(r.itens.find((i) => i.id === "3")?.total.toFixed(2)).toBe("0.00");
    expect(r.semComposicao).toEqual(["3"]);
    expect(r.aprovavel).toBe(false);
  });

  it("item percentual incide sobre o custo direto dos demais", () => {
    const i4 = r.itens.find((i) => i.id === "4")!;
    // 2% × (2224,04 + 751,50) = 59,51 de custo; com BDI de serviço 25% = 74,39
    expect(i4.custoTotal.toFixed(2)).toBe("59.51");
    expect(i4.total.toFixed(2)).toBe("74.39");
  });

  it("totaliza por etapa, custo por m² e compara com o CUB", () => {
    expect(r.total.toFixed(2)).toBe("3681.09");
    expect(r.totaisEtapa.find((t) => t.etapa === "alvenaria")?.total.toFixed(2)).toBe("2780.05");
    expect(r.custoM2?.toFixed(2)).toBe("36.81");
    expect(r.diferencaCub?.toFixed(4)).toBe("0.8405");
  });
});
