import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { abrirXlsx, colunaParaIndice, decodificarXml, ehZip, extrairXlsxDeZip } from "@/lib/importacao/xlsx-leitor";

async function xlsxMinimo(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<workbook><sheets><sheet name="Dados &amp; Preços" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.file("xl/sharedStrings.xml", `<sst><si><t>Código</t></si><si><r><t>Descri</t></r><r><t>ção</t></r></si></sst>`);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
    <row r="3"><c r="A3"><f>HYPERLINK("#"&amp;CELL("address",B1),104658)</f><v>0</v></c><c r="B3"><v>12.5</v></c><c r="C3" t="inlineStr"><is><t>PISO &lt;A&gt;</t></is></c></row>
  </sheetData></worksheet>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("leitor xlsx", () => {
  it("lê abas, strings compartilhadas, texto inline e código de HYPERLINK", async () => {
    const livro = await abrirXlsx(await xlsxMinimo());
    expect(livro.nomesAbas).toEqual(["Dados & Preços"]);
    const aba = await livro.lerAba("Dados & Preços");
    expect(aba.linhas[0]).toEqual(["Código", null, "Descrição"]);
    expect(aba.linhas[1]).toEqual([]);
    expect(aba.linhas[2]).toEqual([104658, 12.5, "PISO <A>"]);
  });

  it("extrai xlsx de dentro de zip e reconhece assinatura", async () => {
    const interno = await xlsxMinimo();
    const externo = new JSZip();
    externo.file("pasta/SINAPI.xlsx", interno);
    externo.file("leia-me.txt", "x");
    const dados = await externo.generateAsync({ type: "uint8array" });
    expect(ehZip(dados)).toBe(true);
    const arquivos = await extrairXlsxDeZip(dados);
    expect(arquivos.map((a) => a.nome)).toEqual(["SINAPI.xlsx"]);
  });

  it("converte referência de coluna e entidades", () => {
    expect(colunaParaIndice("AB12")).toBe(27);
    expect(decodificarXml("a &amp; b &#231;")).toBe("a & b ç");
  });

  it("recusa arquivo que não é planilha", async () => {
    const zip = new JSZip();
    zip.file("x.txt", "oi");
    await expect(abrirXlsx(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow("não é uma planilha");
  });
});
