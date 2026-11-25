import { describe, expect, it } from "vitest";
import { calcularBdi, verificarFaixasBdi, type FaixaBdi } from "@/lib/engine/bdi";

const faixasEdificacao: FaixaBdi[] = [
  { componente: "ac", minimo: "0.03", medio: "0.04", maximo: "0.055" },
  { componente: "bdi", minimo: "0.2034", medio: "0.2212", maximo: "0.25" },
];

describe("BDI (fórmula TCU, Acórdão 2622/2013)", () => {
  it("calcula o caso de aceite 6 com 2 casas", () => {
    const bdi = calcularBdi({ ac: "0.04", s: "0.008", r: "0.0127", g: "0.008", df: "0.0123", l: "0.074", i: "0.0865" });
    // ((1+0,04+0,008+0,0127+0,008) × 1,0123 × 1,074 / (1−0,0865)) − 1 = 0,271922...
    expect(bdi.times(100).toFixed(2)).toBe("27.19");
  });

  it("rejeita tributos ≥ 100%", () => {
    expect(() => calcularBdi({ ac: "0", s: "0", r: "0", g: "0", df: "0", l: "0", i: "1" })).toThrow();
  });

  it("alerta quando o BDI ou um componente sai da faixa de referência", () => {
    const alertas = verificarFaixasBdi(
      { ac: "0.07", s: "0.008", r: "0.0127", g: "0.008", df: "0.0123", l: "0.074", i: "0.0865" }, faixasEdificacao,
    );
    expect(alertas.map((a) => a.componente)).toEqual(["ac", "bdi"]);
    expect(alertas[0]?.mensagem).toContain("acima");
  });

  it("não alerta dentro da faixa", () => {
    const alertas = verificarFaixasBdi(
      { ac: "0.04", s: "0.008", r: "0.0127", g: "0.008", df: "0.0123", l: "0.074", i: "0.0365" }, faixasEdificacao,
    );
    expect(alertas).toEqual([]);
  });
});
