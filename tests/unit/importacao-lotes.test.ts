import { describe, expect, it } from "vitest";
import sinapi from "../fixtures/sinapi-pi-2026-10-amostra.json";
import sicro from "../fixtures/sicro-pi-2026-07-amostra.json";
import type { BaseImportada, ItemImportado } from "@/lib/importacao/parsers/tipos";
import {
  ETAPAS_LOTE, caminhoArquivo, chaveImportacao, contarLotesPorEtapa, loteSchema, montarLotes, nomeSeguro,
  ordemEtapa, requisicaoImportacaoSchema,
} from "@/lib/importacao/lotes";

const baseSinapi = sinapi as BaseImportada;
const baseSicro = sicro as BaseImportada;

function itensFicticios(n: number): ItemImportado[] {
  return Array.from({ length: n }, (_, i) => ({
    composicaoCodigo: "C1", tipoItem: "INSUMO" as const, itemCodigo: `I${i}`, coeficiente: "1",
    utilizacaoOperativa: null, utilizacaoImprodutiva: null, grupoSicro: null, extra: null,
  }));
}

describe("montarLotes", () => {
  it("ordena as etapas insumos → equipamentos → composições → itens com índices globais", () => {
    const lotes = montarLotes(baseSicro);
    expect(lotes.map((l) => l.indice)).toEqual(lotes.map((_, i) => i));
    const ordens = lotes.map((l) => ordemEtapa(l.etapa));
    expect([...ordens].sort((a, b) => a - b)).toEqual(ordens);
    expect(new Set(lotes.map((l) => l.etapa))).toEqual(new Set(ETAPAS_LOTE));
  });

  it("quebra em lotes de no máximo 1000 linhas", () => {
    const base: BaseImportada = { ...baseSinapi, itens: itensFicticios(2501) };
    const lotes = montarLotes(base);
    const itens = lotes.filter((l) => l.etapa === "itens");
    expect(itens.map((l) => l.linhas.length)).toEqual([1000, 1000, 501]);
    expect(contarLotesPorEtapa(lotes).itens).toBe(3);
    expect(contarLotesPorEtapa(lotes).equipamentos).toBe(0);
  });

  it("gera linhas no formato snake_case lido pelas RPCs e válidas no Zod", () => {
    for (const lote of [...montarLotes(baseSinapi), ...montarLotes(baseSicro)]) {
      expect(loteSchema.safeParse(lote).success).toBe(true);
    }
    const item = montarLotes(baseSicro).find((l) => l.etapa === "itens")?.linhas[0];
    expect(Object.keys(item ?? {}).sort()).toEqual([
      "coeficiente", "composicao_codigo", "extra", "grupo_sicro", "item_codigo", "tipo_item",
      "utilizacao_improdutiva", "utilizacao_operativa",
    ]);
  });

  it("é determinístico (a retomada reenvia os mesmos lotes)", () => {
    expect(montarLotes(baseSicro)).toEqual(montarLotes(baseSicro));
  });

  it("recusa tamanho de lote acima de 1000", () => {
    expect(() => montarLotes(baseSinapi, 1001)).toThrow(/Tamanho de lote/);
  });

  it("aceita tamanho menor para testes", () => {
    const lotes = montarLotes(baseSinapi, 2);
    expect(lotes.every((l) => l.linhas.length <= 2)).toBe(true);
  });
});

describe("schemas dos lotes", () => {
  it("recusa número com vírgula, linhas extras e lote vazio", () => {
    const linha = {
      composicao_codigo: "1", tipo_item: "INSUMO", item_codigo: "2", coeficiente: "1,5",
      utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null,
    };
    expect(loteSchema.safeParse({ etapa: "itens", indice: 0, linhas: [linha] }).success).toBe(false);
    expect(loteSchema.safeParse({ etapa: "itens", indice: 0, linhas: [{ ...linha, coeficiente: "1e-7" }] }).success).toBe(true);
    expect(loteSchema.safeParse({ etapa: "itens", indice: 0, linhas: [{ ...linha, coeficiente: "1", x: 1 }] }).success).toBe(false);
    expect(loteSchema.safeParse({ etapa: "itens", indice: 0, linhas: [] }).success).toBe(false);
  });

  it("valida o envelope da rota", () => {
    const hash = "a".repeat(64);
    expect(requisicaoImportacaoSchema.safeParse({
      acao: "estado", fonte: "SINAPI", uf: "PI", mesAno: "2026-10-01", desonerado: false, hash,
    }).success).toBe(true);
    expect(requisicaoImportacaoSchema.safeParse({
      acao: "estado", fonte: "SINAPI", uf: "XX", mesAno: "2026-10-01", desonerado: false, hash,
    }).success).toBe(false);
    expect(requisicaoImportacaoSchema.safeParse({ acao: "apagar_tudo" }).success).toBe(false);
  });
});

describe("chaves e caminhos", () => {
  it("chave inclui UF e desoneração (um arquivo SINAPI traz todas as UFs)", () => {
    expect(chaveImportacao("ab", "PI", true)).toBe("ab:PI:D");
    expect(chaveImportacao("ab", "PI", false)).not.toBe(chaveImportacao("ab", "SP", false));
  });

  it("monta o caminho do Storage sem acentos", () => {
    expect(nomeSeguro("SINAPI_Referência 2026/10.xlsx")).toBe("SINAPI_Referencia_2026_10.xlsx");
    expect(caminhoArquivo("SINAPI", "PI", "2026-10-01", "h", "Referência.xlsx")).toBe("SINAPI/PI/2026-10/h-Referencia.xlsx");
  });
});
