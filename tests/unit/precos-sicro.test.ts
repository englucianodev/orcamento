import { describe, expect, it } from "vitest";
import { criarCalculadoraSicro, type BaseCustoSicro } from "@/lib/engine/precos-sicro";

/** Dados do bloco 0308308 do SICRO PI 07/2026 (Relatório Analítico de Composições). */
function base(): BaseCustoSicro {
  return {
    equipamentos: new Map([["E9050", { chp: "422.0174", chi: "217.3048" }], ["E9999", { chp: "100", chi: "40" }]]),
    insumos: new Map<string, string | null>([
      ["P9801", "23.5469"], ["P9830", "35.1473"], ["M2758", "4890.002"], ["M0003", "6.8918"],
    ]),
    composicoes: new Map([
      ["0308308", {
        producao: "2", fic: "0.02133",
        itens: [
          { grupo: "A" as const, codigo: "E9050", coeficiente: "0.48193", utilizacaoOperativa: "1", utilizacaoImprodutiva: "0" },
          { grupo: "B" as const, codigo: "P9801", coeficiente: "4" },
          { grupo: "B" as const, codigo: "P9830", coeficiente: "1" },
          { grupo: "C" as const, codigo: "M2758", coeficiente: "1" },
          { grupo: "E" as const, codigo: "5915373", coeficiente: "0.038" },
          { grupo: "F" as const, codigo: "5914584", coeficiente: "0.038", vias: { ln: "5914584", rp: "5914599", p: "5914614" } },
        ],
      }],
      ["5915373", { producao: "1", fic: null, itens: [{ grupo: "C" as const, codigo: "M0003", coeficiente: "3.0383" }] }],
      ["5914584", { producao: "1", fic: null, itens: [{ grupo: "C" as const, codigo: "M0003", coeficiente: "0.2" }] }],
      ["5914599", { producao: "1", fic: null, itens: [{ grupo: "C" as const, codigo: "M0003", coeficiente: "0.15" }] }],
      ["5914614", { producao: "1", fic: null, itens: [{ grupo: "C" as const, codigo: "M0003", coeficiente: "0.1" }] }],
      ["9000001", {
        producao: "1", fic: null,
        itens: [{ grupo: "D" as const, codigo: "0308308", coeficiente: "0.5" }, { grupo: "A" as const, codigo: "E9999", coeficiente: "1", utilizacaoOperativa: "0.5", utilizacaoImprodutiva: "0.5" }],
      }],
    ]),
  };
}

describe("motor de preços SICRO", () => {
  it("calcula execução, FIC sobre custo improdutivo + mão de obra e soma C+D+E (DMT zero)", () => {
    const calc = criarCalculadoraSicro(base());
    const d = calc.detalhe("0308308");
    expect(d?.custoHorarioEquipamentos.toFixed(4)).toBe("203.3828");
    expect(d?.custoHorarioMaoObra.toFixed(4)).toBe("129.3349");
    expect(d?.custoExecucao.toFixed(4)).toBe("166.3589");
    // FIC = 0,02133 × (0,48193×217,3048 + 129,3349) / 2 = 2,4963 (valor publicado)
    expect(d?.custoFic.toFixed(4)).toBe("2.4963");
    expect(d?.custoMateriais.toFixed(4)).toBe("4890.0020");
    expect(d?.custoTempoFixo.toFixed(4)).toBe("0.7957");
    expect(d?.custoTransporte.toFixed(4)).toBe("0.0000");
    expect(calc.custo("0308308")?.toFixed(2)).toBe("5059.65");
  });

  it("aplica o momento de transporte com a DMT da obra por tipo de via", () => {
    const calc = criarCalculadoraSicro(base(), { dmt: { ln: "10", rp: "0", p: "50" } });
    // LN: 0,038×10×1,38 = 0,5244; P: 0,038×50×0,69 = 1,311
    expect(calc.detalhe("0308308")?.custoTransporte.toFixed(4)).toBe("1.8354");
  });

  it("usa o custo final da composição auxiliar (grupo D) e utilizações do equipamento", () => {
    const calc = criarCalculadoraSicro(base());
    const d = calc.detalhe("9000001");
    expect(d?.custoHorarioEquipamentos.toFixed(4)).toBe("70.0000");
    expect(d?.custoAtividadesAuxiliares.toFixed(4)).toBe("2529.8250");
    expect(calc.custo("9000001")?.toFixed(2)).toBe("2599.83");
  });

  it("retorna null quando falta preço e informa o motivo", () => {
    const b = base();
    const ins = new Map(b.insumos);
    ins.set("P9830", null);
    const calc = criarCalculadoraSicro({ ...b, insumos: ins });
    expect(calc.custo("0308308")).toBeNull();
    expect(calc.faltantes("0308308")).toContain("insumo P9830 sem preço");
  });

  it("detecta ciclo", () => {
    const b = base();
    const comps = new Map(b.composicoes);
    comps.set("1", { producao: "1", fic: null, itens: [{ grupo: "D", codigo: "2", coeficiente: "1" }] });
    comps.set("2", { producao: "1", fic: null, itens: [{ grupo: "D", codigo: "1", coeficiente: "1" }] });
    expect(() => criarCalculadoraSicro({ ...b, composicoes: comps }).custo("1")).toThrow(/Ciclo/);
  });
});
