import { describe, expect, it } from "vitest";
import isd from "../fixtures/sinapi-aba-isd-recorte.json";
import csd from "../fixtures/sinapi-aba-csd-recorte.json";
import analitico from "../fixtures/sinapi-aba-analitico-recorte.json";
import {
  classificarInsumo, detectarSinapi2025, lerMesReferencia, parseAnaliticoSinapi, parseComposicoesSinapi,
  parseEncargosSinapi, parseInsumosSinapi,
} from "@/lib/importacao/parsers/sinapi-2025";
import { codigoSicro, identificarArquivoSicro, parseEquipamentosSicro } from "@/lib/importacao/parsers/sicro-2024";
import { parseAnaliticoSicro } from "@/lib/importacao/parsers/sicro-analitico";
import { LayoutDesconhecidoError } from "@/lib/importacao/parsers/tipos";
import { localizarCabecalho, mesAnoParaData, numeroTexto } from "@/lib/importacao/parsers/util";
import type { Planilha } from "@/lib/importacao/xlsx-leitor";

const abaIsd = isd as Planilha;
const abaCsd = csd as Planilha;
const abaAn = analitico as Planilha;

describe("parser SINAPI (layout Referência 2025)", () => {
  it("detecta o layout pelas abas", () => {
    expect(detectarSinapi2025(["Menu", "ISD", "ICD", "ISE", "CSD", "CCD", "CSE", "Analítico"])).toBe(true);
    expect(detectarSinapi2025(["Plan1"])).toBe(false);
  });

  it("lê mês de referência, insumos e encargos da UF escolhida", () => {
    expect(lerMesReferencia(abaIsd)).toBe("2026-10-01");
    const insumos = parseInsumosSinapi(abaIsd, "PI");
    expect(insumos.length).toBeGreaterThan(40);
    expect(insumos[0]).toMatchObject({ codigo: "45333", tipo: "SERVICO", unidade: "UN" });
    expect(parseEncargosSinapi(abaIsd, "PI")).toEqual({ horistaPct: "113.78", mensalistaPct: "71.59" });
  });

  it("lê composições (código vindo da fórmula HYPERLINK) e o custo da UF", () => {
    const comps = parseComposicoesSinapi(abaCsd, "AC");
    expect(comps[0]).toMatchObject({ codigo: "104658", unidade: "M2", precoPublicado: "269.08", grupo: "Acessibilidade" });
  });

  it("lê itens do analítico", () => {
    const itens = parseAnaliticoSinapi(abaAn);
    expect(itens[0]).toMatchObject({ composicaoCodigo: "104658", tipoItem: "COMPOSICAO", itemCodigo: "88316", coeficiente: "1.279" });
  });

  it("para com os cabeçalhos quando o layout é desconhecido", () => {
    const estranha: Planilha = { nome: "X", linhas: [["Coluna A", "Coluna B"], [1, 2]] };
    expect(() => parseInsumosSinapi(estranha, "PI")).toThrow(LayoutDesconhecidoError);
    try {
      parseInsumosSinapi(estranha, "PI");
    } catch (e) {
      expect((e as LayoutDesconhecidoError).cabecalhosEncontrados[0]).toEqual(["Coluna A", "Coluna B"]);
    }
  });

  it("classifica insumos", () => {
    expect(classificarInsumo("EQUIPAMENTO (LOCAÇÃO)")).toBe("EQUIPAMENTO");
    expect(classificarInsumo("ENCARGOS COMPLEMENTARES")).toBe("MAO_OBRA");
    expect(classificarInsumo("MATERIAL")).toBe("MATERIAL");
  });
});

describe("parser SICRO", () => {
  const analiticoSicro: Planilha = {
    nome: "Sheet1",
    linhas: [
      ["SISTEMA DE CUSTOS REFERENCIAIS DE OBRAS - SICRO", null, null, "Piauí", null, null, "FIC", 0.02133],
      ["Custo Unitário de Referência", null, null, "Julho/2026", null, null, "Produção da equipe ", 2, "un"],
      ["0308308", "Aparelho de apoio", null, null, null, null, null, "Valores em reais (R$)"],
      ["A - EQUIPAMENTOS", null, "Quantidade"],
      ["E9050", "Guindaste", 0.48193, 1, 0, 422.0174, 217.3048, null, 203.3828],
      ["B - MÃO DE OBRA"],
      ["P9801", "Ajudante", 4, "h", null, 23.5469, null, null, 94.1876],
      ["C - MATERIAL"],
      ["M2758", "Aparelho", 1, "un", null, 4890.002, null, null, 4890.002],
      ["D - ATIVIDADES AUXILIARES"],
      ["1108059", "Microconcreto", 0.02305, "m³", null, 3785.91, null, null, 87.2652],
      ["E - TEMPO FIXO"],
      ["M2758", "Aparelho - Caminhão", "5915373", 0.038, "t", null, 20.94, null, 0.7957],
      ["F - MOMENTO DE TRANSPORTE"],
      [null, null, null, null, "LN", "RP", "P"],
      ["M2758", "Aparelho - Caminhão", 0.038, "tkm", "5914584", "5914599", "5914614"],
      [null, null, null, null, "Custo unitário direto total", null, null, null, 5146.92],
    ],
  };

  it("lê blocos A–F, FIC, produção e preço publicado", () => {
    const r = parseAnaliticoSicro(analiticoSicro);
    expect(r.uf).toBe("PI");
    expect(r.mesAno).toBe("2026-07-01");
    expect(r.composicoes[0]).toMatchObject({ codigo: "0308308", producaoEquipe: "2", fic: "0.02133", unidade: "un", precoPublicado: "5146.92" });
    expect(r.itens.map((i) => i.grupoSicro)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(r.itens[5]?.extra).toEqual({ material: "M2758", ln: "5914584", rp: "5914599", p: "5914614" });
    expect(r.precosVistos.equipamentos[0]).toMatchObject({ codigo: "E9050", chi: "217.3048" });
  });

  it("identifica o tipo de arquivo e normaliza código", () => {
    expect(identificarArquivoSicro("x.xlsx", analiticoSicro)).toBe("composicoes_analitico");
    expect(codigoSicro(307731)).toBe("0307731");
    const eq: Planilha = {
      nome: "Sheet1",
      linhas: [
        ["Código", "Descrição", "Valor de Aquisição (R$)", "Depreciação (R$/h)", "Oportunidade de Capital (R$/h)", "Seguros e Impostos", "Manutenção (R$/h)", "Operação (R$/h)", "Mão de Obra de Operação (R$/h)", "Custo Produtivo (R$/h)", "Custo Improdutivo (R$/h)"],
        ["E9001", "Conjunto vibratório", 76650.99, 10.2201, 1.5765, 0, 7.6651, 0, 0, 19.4617, 11.7966],
      ],
    };
    expect(identificarArquivoSicro("PI 07-2026 Relatório Sintético de Equipamentos.xlsx", eq)).toBe("equipamentos");
    expect(parseEquipamentosSicro(eq).custos[0]).toMatchObject({ codigo: "E9001", chp: "19.4617", chi: "11.7966" });
  });
});

describe("utilitários", () => {
  it("converte números e datas", () => {
    expect(numeroTexto("1.234,56")).toBe("1234.56");
    expect(numeroTexto("-")).toBeNull();
    expect(numeroTexto(0.6650246)).toBe("0.6650246");
    expect(mesAnoParaData("Julho/2026")).toBe("2026-07-01");
    expect(mesAnoParaData("10/2026")).toBe("2026-10-01");
    expect(localizarCabecalho([["a"], ["Código", "Descrição"]], { c: "Código", d: "Descrição" })?.linha).toBe(1);
  });
});
