import { describe, expect, it } from "vitest";
import {
  br, fracaoParaPercentual, limparZeros, mensagemBanco, normalizarDecimal, paraCampo, percentualParaFracao,
} from "@/components/configuracoes/decimais";
import {
  arquivoLogoSchema, bdiDoFormulario, bdiParaBanco, bdiSchema, caminhoLogo, caminhoLogoValido, composicaoPropriaSchema,
  configPadraoDoFormulario, configPadraoSchema, indiceSchema, mapeamentoSchema,
} from "@/components/configuracoes/esquemas";
import { PADROES_ACABAMENTO } from "@/lib/engine/padroes";

describe("decimais (texto, sem float)", () => {
  it("normaliza vírgula e separador de milhar", () => {
    expect(normalizarDecimal("1.234,56")).toBe("1234.56");
    expect(normalizarDecimal(" 1,5 ")).toBe("1.5");
    expect(normalizarDecimal("2.25")).toBe("2.25");
    expect(normalizarDecimal(3)).toBe("3");
    expect(normalizarDecimal(null)).toBe("");
  });

  it("converte percentual ↔ fração sem erro de ponto flutuante", () => {
    expect(percentualParaFracao("6,65")).toBe("0.0665");
    expect(percentualParaFracao("0.1")).toBe("0.001");
    expect(fracaoParaPercentual("0.0665")).toBe("6.65");
    expect(fracaoParaPercentual(0.004)).toBe("0.4");
    expect(fracaoParaPercentual("0.07")).toBe("7");
    expect(percentualParaFracao(fracaoParaPercentual("0.0127"))).toBe("0.0127");
  });

  it("formata e limpa zeros", () => {
    expect(limparZeros("6.6500")).toBe("6.65");
    expect(limparZeros("2.000")).toBe("2");
    expect(br("1234.5")).toBe("1.234,5");
    expect(br(null)).toBe("—");
    expect(paraCampo("0.30")).toBe("0,3");
  });

  it("traduz erros do banco", () => {
    expect(mensagemBanco({ code: "23505", message: "dup" }, "salvar")).toMatch(/já existe/);
    expect(mensagemBanco({ code: "42501", message: "x" }, "salvar")).toMatch(/permissão/);
    expect(mensagemBanco({ message: "new row violates row-level security policy" }, "salvar")).toMatch(/permissão/);
    expect(mensagemBanco({ message: "falhou" }, "salvar")).toMatch(/Tente novamente/);
  });
});

describe("índices", () => {
  it("aceita decimal com vírgula e rejeita negativo ou texto", () => {
    expect(indiceSchema.parse({ chave: "k_paredes", valor: "0,15" }).valor).toBe("0.15");
    expect(indiceSchema.safeParse({ chave: "k_paredes", valor: "-1" }).success).toBe(false);
    expect(indiceSchema.safeParse({ chave: "k_paredes", valor: "abc" }).success).toBe(false);
    expect(indiceSchema.safeParse({ chave: "K PAREDES", valor: "1" }).success).toBe(false);
  });
});

describe("mapeamento", () => {
  const base = "11111111-1111-4111-8111-111111111111";
  it("exige fator > 0 e base para SINAPI/SICRO", () => {
    const ok = mapeamentoSchema.parse({ id: "", chave: "PISO_X", fonte: "SINAPI", padrao: "", codigo: " 87263 ", fator: "1,5", base });
    expect(ok).toMatchObject({ id: null, padrao: null, codigo: "87263", fator: "1.5" });
    expect(mapeamentoSchema.safeParse({ chave: "PISO_X", fonte: "SINAPI", codigo: "1", fator: "0", base }).success).toBe(false);
    expect(mapeamentoSchema.safeParse({ chave: "PISO_X", fonte: "SICRO", codigo: "1", fator: "1", base: "" }).success).toBe(false);
    expect(mapeamentoSchema.safeParse({ chave: "PISO_X", fonte: "PROPRIA", codigo: "P-01", fator: "1", base: "" }).success).toBe(true);
    expect(mapeamentoSchema.safeParse({ chave: "PISO_X", fonte: "PROPRIA", codigo: "a b", fator: "1" }).success).toBe(false);
  });
});

describe("composição própria", () => {
  it("limita o custo a 4 casas", () => {
    const d = composicaoPropriaSchema.parse({ id: "", codigo: "P-01", descricao: "Serviço próprio", unidade: "m²", preco: "12,3456" });
    expect(d).toMatchObject({ id: null, preco: "12.3456" });
    expect(composicaoPropriaSchema.safeParse({ codigo: "P", descricao: "Serviço", unidade: "m", preco: "1.23456" }).success).toBe(false);
    expect(composicaoPropriaSchema.parse({ id: "7", codigo: "P", descricao: "Serviço", unidade: "m", preco: "0" }).id).toBe(7);
  });
});

describe("BDI", () => {
  const form = { id: "", nome: "BDI obra", tipo: "servico", tipo_obra: "edificacoes", ac: "4", s: "0,8", r: "1,27", g: "0,8", df: "1,23", l: "7,4", i: "8,65" };
  it("valida percentuais e converte para fração", () => {
    const d = bdiSchema.parse(form);
    expect(bdiParaBanco(d)).toMatchObject({ ac: "0.04", s: "0.008", r: "0.0127", i: "0.0865", tipo_obra: "edificacoes" });
    expect(bdiSchema.safeParse({ ...form, i: "100" }).success).toBe(false);
    expect(bdiSchema.safeParse({ ...form, l: "-1" }).success).toBe(false);
    expect(bdiSchema.safeParse({ ...form, tipo_obra: "rodovias" }).success).toBe(false);
  });
  it("calcula o BDI ao vivo pela fórmula do TCU", () => {
    expect(Number(bdiDoFormulario(form)).toFixed(4)).toBe("0.2719");
    expect(bdiDoFormulario({ ...form, ac: "x" })).toBeNull();
  });
});

describe("padrão de acabamento", () => {
  it("lê o formulário e valida a ConfigPadrao", () => {
    const n = PADROES_ACABAMENTO.normal;
    const f = new FormData();
    const campos: Record<string, string> = {
      rotulo: n.rotulo, pisoSeco: n.pisoSeco, pisoMolhado: n.pisoMolhado, pintura: n.pintura,
      forroSeco: n.forroSeco, forroMolhado: n.forroMolhado, janela: n.janela, portaInterna: n.portaInterna,
      portaExterna: n.portaExterna, bancadas: n.bancadas, loucasMetais: n.loucasMetais, multiplicadorPontos: "1,2",
      "revestimentoBanheiro.tipo": "ceramica", "revestimentoBanheiro.altura": "0", "revestimentoBanheiro.ateOTeto": "on",
      "revestimentoCozinha.tipo": "ceramica", "revestimentoCozinha.altura": "1,5",
    };
    for (const [k, v] of Object.entries(campos)) f.set(k, v);
    const cfg = configPadraoSchema.parse(configPadraoDoFormulario(f));
    expect(cfg).toEqual({ ...n, multiplicadorPontos: "1.2" });
    f.set("pisoSeco", "tapete");
    expect(configPadraoSchema.safeParse(configPadraoDoFormulario(f)).success).toBe(false);
  });
});

describe("logo", () => {
  const empresa = "22222222-2222-4222-8222-222222222222";
  it("aceita PNG/JPEG até 2 MB e monta o caminho da empresa", () => {
    expect(arquivoLogoSchema.safeParse({ type: "image/png", size: 1000 }).success).toBe(true);
    expect(arquivoLogoSchema.safeParse({ type: "image/gif", size: 1000 }).success).toBe(false);
    expect(arquivoLogoSchema.safeParse({ type: "image/jpeg", size: 3 * 1024 * 1024 }).success).toBe(false);
    expect(caminhoLogo(empresa, "image/jpeg")).toBe(`${empresa}/logo.jpg`);
    expect(caminhoLogoValido(empresa, `${empresa}/logo.png`)).toBe(true);
    expect(caminhoLogoValido(empresa, `outra/logo.png`)).toBe(false);
  });
});
