import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { gerarExcel } from "@/lib/relatorios/excel";
import { montarModeloRelatorio } from "@/lib/relatorios/modelo";
import { gerarPdf, logoParaPdf } from "@/lib/relatorios/pdf";
import { textoPdf } from "@/lib/relatorios/pdf-partes/base";
import { TIPOS_RELATORIO } from "@/lib/relatorios/tipos-relatorio";
import { dadosFixture, FAIXAS, FECHAMENTO_SINAPI } from "./relatorios-fixture";

const modelo = montarModeloRelatorio(dadosFixture({ cub: "2500" }), {
  dataEmissao: "25/11/2026", composicoes: { sinapi: FECHAMENTO_SINAPI }, faixas: FAIXAS,
  encargos: [{ base_id: "base-sinapi", horista_pct: "113.68", mensalista_pct: "71.05" }],
});

describe("arquivos de relatório (smoke)", () => {
  it.each(TIPOS_RELATORIO)("gera o PDF %s", async (tipo) => {
    const pdf = await gerarPdf(modelo, tipo);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);

  it("gera o Excel completo com as 8 abas e células numéricas", async () => {
    const bytes = await gerarExcel(modelo, "completo");
    expect(bytes.length).toBeGreaterThan(1000);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Sintética", "Analítica", "Memória", "Composições", "BDI", "Curva ABC", "Cronograma", "Resumo"]);
    const ws = wb.getWorksheet("Sintética")!;
    const valores: unknown[] = [];
    ws.eachRow((row) => valores.push(row.getCell(8).value));
    expect(valores).toContain(Number(modelo.sintetica.total.n));
  });

  it("gera Excel de um tipo só com a aba correspondente", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await gerarExcel(modelo, "cronograma")) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Cronograma"]);
  });

  it("aceita logo PNG/JPEG e recusa outros formatos", () => {
    expect(logoParaPdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))?.format).toBe("png");
    expect(logoParaPdf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.format).toBe("jpg");
    expect(logoParaPdf(new TextEncoder().encode("<svg"))).toBeNull();
  });

  it("troca símbolos fora da Helvetica embutida", () => {
    expect(textoPdf("a − b → c ≥ d, área 10 m² × 2")).toBe("a - b -> c >= d, área 10 m² × 2");
  });
});
