import { describe, expect, it } from "vitest";
import { geometriaAmbiente, geometriaObra } from "@/lib/engine/geometria";
import { criarIndices } from "@/lib/engine/indices";
import { entrada, quartoAceite } from "./entrada-exemplo";

const todosOsVaos = criarIndices({ desconto_vaos_area_minima: "0" });

describe("caso de aceite 1 — geometria do quarto 3,00 × 4,00", () => {
  const g = geometriaAmbiente(quartoAceite(), todosOsVaos);

  it("calcula área, perímetro, parede bruta, vãos e parede líquida", () => {
    expect(g.area.toFixed(2)).toBe("12.00");
    expect(g.perimetro.toFixed(2)).toBe("14.00");
    expect(g.paredeBruta.toFixed(2)).toBe("39.20");
    expect(g.vaosArea.toFixed(2)).toBe("2.88");
    expect(g.paredeLiquida.toFixed(2)).toBe("36.32");
  });

  it("guarda a memória de cálculo no formato do prompt", () => {
    expect(g.memoriaParede).toBe("Quarto 1: (3,00+4,00)×2×2,80 − 2,88 = 36,32 m²");
  });
});

describe("regras de geometria", () => {
  it("pela regra padrão só desconta vãos maiores que 2,00 m²", () => {
    const g = geometriaAmbiente(quartoAceite(), criarIndices());
    expect(g.vaosDescontados.toFixed(2)).toBe("0.00");
    expect(g.paredeLiquida.toFixed(2)).toBe("39.20");
  });

  it("aplica fração parcial de paredes e pé-direito duplo", () => {
    const a = { ...quartoAceite(), paredes: { modo: "parcial" as const, percentual: 50 }, peDireitoDuplo: true, vaos: [] };
    const g = geometriaAmbiente(a, todosOsVaos);
    expect(g.altura.toFixed(2)).toBe("5.60");
    expect(g.paredeBruta.toFixed(2)).toBe("39.20");
    const livre = geometriaAmbiente({ ...a, alturaLivre: 5 }, todosOsVaos);
    expect(livre.altura.toFixed(2)).toBe("5.00");
  });

  it("ambiente sem paredes não tem parede", () => {
    const g = geometriaAmbiente({ ...quartoAceite(), paredes: { modo: "nenhuma", percentual: 0 }, vaos: [] }, todosOsVaos);
    expect(g.paredeBruta.isZero()).toBe(true);
  });

  it("área manual estima o perímetro como quadrado quando não informado", () => {
    const g = geometriaAmbiente({ ...quartoAceite(), largura: null, comprimento: null, areaManual: 16, vaos: [] }, todosOsVaos);
    expect(g.area.toFixed(2)).toBe("16.00");
    expect(g.perimetro.toFixed(2)).toBe("16.00");
    expect(g.memoriaParede).toContain("perímetro estimado");
    const comP = geometriaAmbiente({ ...quartoAceite(), largura: null, comprimento: null, areaManual: 16, perimetroManual: 20, vaos: [] }, todosOsVaos);
    expect(comP.perimetro.toFixed(2)).toBe("20.00");
  });

  it("multiplica vãos pela quantidade", () => {
    const a = quartoAceite();
    const g = geometriaAmbiente({ ...a, vaos: [{ ...a.vaos[1]!, quantidade: 3 }] }, todosOsVaos);
    expect(g.vaosArea.toFixed(2)).toBe("3.60");
  });
});

describe("geometria da obra", () => {
  it("estima projeção, perímetro externo e comprimento de alvenaria", () => {
    const e = entrada([quartoAceite()]);
    const g = geometriaObra(e, todosOsVaos);
    const p = g.pavimentos[0]!;
    // 12 × 1,12 = 13,44 m²; retângulo 1:1,5 → lados 2,9933 × 4,4900
    expect(p.projecao.toFixed(2)).toBe("13.44");
    expect(p.perimetroExterno.toFixed(2)).toBe("14.97");
    // (14 + 14,97) / 2
    expect(p.comprimentoAlvenaria.toFixed(2)).toBe("14.48");
    expect(g.areaConstruida.toFixed(2)).toBe("13.44");
  });

  it("usa a projeção informada no térreo", () => {
    const e = entrada([quartoAceite()], { construcao: { projecaoLargura: 10, projecaoComprimento: 12 } });
    const g = geometriaObra(e, todosOsVaos);
    expect(g.pavimentos[0]?.projecao.toFixed(2)).toBe("120.00");
    expect(g.pavimentos[0]?.perimetroExterno.toFixed(2)).toBe("44.00");
    expect(g.terreo.largura.toFixed(2)).toBe("10.00");
  });
});
