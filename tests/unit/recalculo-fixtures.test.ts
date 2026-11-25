import { describe, expect, it } from "vitest";
import sinapi from "../fixtures/sinapi-pi-2026-10-amostra.json";
import sicro from "../fixtures/sicro-pi-2026-07-amostra.json";
import { D } from "@/lib/engine/decimal";
import { criarCalculadoraSinapi } from "@/lib/engine/precos-sinapi";
import { criarCalculadoraSicro } from "@/lib/engine/precos-sicro";
import type { BaseImportada } from "@/lib/importacao/parsers/tipos";
import { baseParaMotorSicro, baseParaMotorSinapi } from "@/lib/importacao/para-motor";

const baseSinapi = sinapi as BaseImportada;
const baseSicro = sicro as BaseImportada;

describe("caso de aceite 4 — SINAPI PI 10/2026 (fixture oficial)", () => {
  const calc = criarCalculadoraSinapi(baseParaMotorSinapi(baseSinapi));

  it("tem composições com auxiliares encadeadas na amostra", () => {
    const comAux = baseSinapi.itens.filter((i) => i.tipoItem === "COMPOSICAO");
    expect(comAux.length).toBeGreaterThan(5);
  });

  it.each(baseSinapi.composicoes.filter((c) => c.precoPublicado !== null).map((c) => [c.codigo, c.precoPublicado]))(
    "composição %s recalculada = publicado (± R$ 0,01)",
    (codigo, publicado) => {
      const v = calc.custo(String(codigo));
      expect(v).not.toBeNull();
      expect(v?.minus(String(publicado)).abs().lte(new D("0.01"))).toBe(true);
    },
  );
});

describe("SICRO PI 07/2026 (fixture oficial)", () => {
  const calc = criarCalculadoraSicro(baseParaMotorSicro(baseSicro));
  it.each(baseSicro.composicoes.filter((c) => c.precoPublicado !== null && c.codigo !== "0307730").map((c) => [c.codigo, c.precoPublicado]))(
    "composição %s recalculada = publicado (± R$ 0,01)",
    (codigo, publicado) => {
      const v = calc.custo(String(codigo));
      expect(v?.minus(String(publicado)).abs().lte(new D("0.01"))).toBe(true);
    },
  );
});
