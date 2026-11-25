import { describe, expect, it } from "vitest";
import { passoDoCaminho, validarPasso, valoresIniciais } from "@/components/wizard/valores";

describe("passoDoCaminho", () => {
  it("leva cada seção da entrada ao seu passo", () => {
    expect(passoDoCaminho("entrada.terreno.largura")).toBe(2);
    expect(passoDoCaminho("entrada.ambientes.3.vaos.0.largura")).toBe(4);
    expect(passoDoCaminho("entrada.lazer.piscina")).toBe(7);
  });

  it("os campos de meta mostrados no passo 1 ficam no passo 1; BDI e DMT no passo 9", () => {
    expect(passoDoCaminho("meta.cub_m2")).toBe(1);
    expect(passoDoCaminho("meta.mes_base_sicro")).toBe(1);
    expect(passoDoCaminho("meta.responsavel.nome")).toBe(1);
    expect(passoDoCaminho("meta.dmt.ln")).toBe(9);
    expect(passoDoCaminho("meta.bdi_servico_id")).toBe(9);
  });
});

describe("validarPasso", () => {
  it("um CUB fora do limite no passo 1 aponta para um campo do passo 1", () => {
    const v = valoresIniciais({}, null);
    const erros = validarPasso(1, { ...v, meta: { ...v.meta, cub_m2: 10_000_000 } });
    const doCub = erros.find((e) => e.caminho === "meta.cub_m2");
    expect(doCub).toBeDefined();
    expect(passoDoCaminho(doCub!.caminho)).toBe(1);
  });
});
