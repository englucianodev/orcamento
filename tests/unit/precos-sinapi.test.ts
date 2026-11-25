import { describe, expect, it } from "vitest";
import { CicloComposicaoError, criarCalculadoraSinapi, type BaseCustoSinapi } from "@/lib/engine/precos-sinapi";

function base(): BaseCustoSinapi {
  return {
    insumos: new Map<string, string | null>([
      ["6111", "15.94"], ["4750", "21.8"], ["36178", "13.79"], ["34357", "4.58"], ["34353", "1.45"],
      ["999", null],
    ]),
    composicoes: new Map([
      ["88316", [{ tipo: "INSUMO" as const, codigo: "6111", coeficiente: "1" }]],
      ["88309", [{ tipo: "INSUMO" as const, codigo: "4750", coeficiente: "1" }]],
      ["104658", [
        { tipo: "COMPOSICAO" as const, codigo: "88316", coeficiente: "1.279" },
        { tipo: "COMPOSICAO" as const, codigo: "88309", coeficiente: "0.639" },
        { tipo: "INSUMO" as const, codigo: "36178", coeficiente: "6.4375" },
        { tipo: "INSUMO" as const, codigo: "34357", coeficiente: "0.24" },
        { tipo: "INSUMO" as const, codigo: "34353", coeficiente: "8.62" },
      ]],
      ["700", [{ tipo: "INSUMO" as const, codigo: "999", coeficiente: "2" }]],
      ["701", [{ tipo: "COMPOSICAO" as const, codigo: "700", coeficiente: "1" }]],
    ]),
  };
}

describe("motor de preços SINAPI", () => {
  it("trunca o total de cada linha em 2 casas (regra oficial, conferida com o SINAPI 10/2026)", () => {
    // Arrange
    const calc = criarCalculadoraSinapi(base());
    // Act
    const custo = calc.custo("104658");
    // Assert: 1,279×15,94=20,38726→20,38; 0,639×21,80=13,9302→13,93; 88,773125→88,77; 1,0992→1,09; 12,499→12,49
    expect(custo?.toFixed(2)).toBe("136.66");
  });

  it("usa precisão total quando a regra é 'exata'", () => {
    const calc = criarCalculadoraSinapi(base(), { regraLinha: "exata" });
    expect(calc.custo("104658")?.toFixed(4)).toBe("136.6888");
  });

  it("encadeia composições auxiliares e devolve a analítica com totais por linha", () => {
    const calc = criarCalculadoraSinapi(base());
    const linhas = calc.analitica("104658");
    expect(linhas).toHaveLength(5);
    expect(linhas[0]).toMatchObject({ tipo: "COMPOSICAO", codigo: "88316" });
    expect(linhas[0]?.precoUnitario?.toFixed(2)).toBe("15.94");
    expect(linhas[0]?.total?.toFixed(2)).toBe("20.38");
  });

  it("retorna null e lista os insumos sem preço", () => {
    const calc = criarCalculadoraSinapi(base());
    expect(calc.custo("701")).toBeNull();
    expect(calc.faltantes("701")).toEqual(["insumo 999 sem preço"]);
  });

  it("acusa composição inexistente", () => {
    const calc = criarCalculadoraSinapi(base());
    expect(calc.custo("123")).toBeNull();
    expect(calc.faltantes("123")).toEqual(["composição 123 não encontrada"]);
  });

  it("detecta ciclo entre composições com erro claro", () => {
    const b = base();
    const comps = new Map(b.composicoes);
    comps.set("1", [{ tipo: "COMPOSICAO", codigo: "2", coeficiente: "1" }]);
    comps.set("2", [{ tipo: "COMPOSICAO", codigo: "3", coeficiente: "1" }]);
    comps.set("3", [{ tipo: "COMPOSICAO", codigo: "1", coeficiente: "1" }]);
    const calc = criarCalculadoraSinapi({ ...b, composicoes: comps });
    expect(() => calc.custo("1")).toThrow(CicloComposicaoError);
    expect(() => calc.custo("1")).toThrow("Ciclo entre composições: 1 → 2 → 3 → 1");
  });
});
