import { describe, expect, it } from "vitest";
import sinapi from "../fixtures/sinapi-pi-2026-10-amostra.json";
import sicro from "../fixtures/sicro-pi-2026-07-amostra.json";
import type { BaseImportada } from "@/lib/importacao/parsers/tipos";
import {
  LIMITE_LISTA_ARMAZENADA, validacaoArmazenadaSchema, validacaoParaArmazenar, validarRecalculo,
} from "@/lib/importacao/validacao";

const baseSinapi = sinapi as BaseImportada;
const baseSicro = sicro as BaseImportada;

describe("validarRecalculo", () => {
  it("SINAPI oficial: todas as composições com preço conferem", () => {
    const r = validarRecalculo(baseSinapi);
    const comPreco = baseSinapi.composicoes.filter((c) => c.precoPublicado !== null).length;
    expect(r.comparadas + r.semCusto.length).toBe(comPreco);
    expect(r.comparadas).toBeGreaterThan(0);
    expect(r.divergentes).toEqual([]);
    expect(r.semPublicado).toBe(baseSinapi.composicoes.length - comPreco);
  });

  it("SICRO oficial: só a composição sabidamente divergente aparece", () => {
    const r = validarRecalculo(baseSicro);
    expect(r.comparadas).toBeGreaterThan(0);
    expect(r.divergentes.every((d) => d.codigo === "0307730")).toBe(true);
  });

  it("lista divergência acima de R$ 0,01 com a diferença", () => {
    const alvo = baseSinapi.composicoes.find((c) => c.precoPublicado !== null);
    if (!alvo) throw new Error("fixture sem composição com preço");
    const alterada: BaseImportada = {
      ...baseSinapi,
      composicoes: baseSinapi.composicoes.map((c) => (c.codigo === alvo.codigo ? { ...c, precoPublicado: "0.50" } : c)),
    };
    const r = validarRecalculo(alterada);
    const d = r.divergentes.find((x) => x.codigo === alvo.codigo);
    expect(d?.publicado).toBe("0.50");
    expect(d && Number(d.diferenca)).toBeGreaterThan(0.01);
  });

  it("composição sem insumo com preço vai para semCusto", () => {
    const alvo = baseSinapi.itens.find((i) => i.tipoItem === "INSUMO");
    if (!alvo) throw new Error("fixture sem item insumo");
    const sem: BaseImportada = {
      ...baseSinapi,
      insumos: baseSinapi.insumos.map((i) => (i.codigo === alvo.itemCodigo ? { ...i, preco: null } : i)),
    };
    const r = validarRecalculo(sem);
    expect(r.semCusto.some((s) => s.codigo === alvo.composicaoCodigo && /sem preço/.test(s.motivo))).toBe(true);
  });

  it("ciclo entre composições não derruba a validação", () => {
    const ciclo: BaseImportada = {
      ...baseSinapi,
      composicoes: [{ codigo: "X1", descricao: "x", unidade: "m", grupo: null, precoPublicado: "1", producaoEquipe: null, fic: null, fit: null }],
      itens: [{
        composicaoCodigo: "X1", tipoItem: "COMPOSICAO", itemCodigo: "X1", coeficiente: "1",
        utilizacaoOperativa: null, utilizacaoImprodutiva: null, grupoSicro: null, extra: null,
      }],
    };
    const r = validarRecalculo(ciclo);
    expect(r.semCusto[0]?.motivo).toMatch(/Ciclo/);
  });
});

describe("validacaoParaArmazenar", () => {
  it("limita as listas e mantém os totais", () => {
    const muitas = Array.from({ length: LIMITE_LISTA_ARMAZENADA + 10 }, (_, i) => ({
      codigo: String(i), publicado: "1", calculado: "2", diferenca: "1",
    }));
    const v = validacaoParaArmazenar({ comparadas: 600, divergentes: muitas, semCusto: [], semPublicado: 3 });
    expect(v.totalDivergentes).toBe(LIMITE_LISTA_ARMAZENADA + 10);
    expect(v.divergentes).toHaveLength(LIMITE_LISTA_ARMAZENADA);
    expect(validacaoArmazenadaSchema.safeParse(v).success).toBe(true);
  });
});
