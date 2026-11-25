import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { abrirXlsx, extrairXlsxDeZip } from "../../src/lib/importacao/xlsx-leitor";
import { amostraCabecalhos } from "../../src/lib/importacao/parsers/util";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface InfoAba {
  nome: string;
  linhas: number;
  colunas: number;
  amostra: string[][];
}

export interface InfoArquivo {
  caminho: string;
  tipo: string;
  tamanhoBytes: number;
  abas?: InfoAba[];
  paginasPdf?: number;
  textoPdf?: string;
  conteudoZip?: string[];
}

export function listarArquivos(raiz: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(raiz)) {
    const p = join(raiz, nome);
    if (statSync(p).isDirectory()) saida.push(...listarArquivos(p));
    else saida.push(p);
  }
  return saida.sort();
}

/** Texto das primeiras páginas (capa, sumário) para resumir o conteúdo do PDF. */
async function lerPdf(dados: Buffer, paginas = 12): Promise<{ paginas: number; texto: string }> {
  const doc = await getDocument({ data: new Uint8Array(dados), verbosity: 0 }).promise;
  const partes: string[] = [];
  for (let p = 1; p <= Math.min(paginas, doc.numPages); p++) {
    const conteudo = await (await doc.getPage(p)).getTextContent();
    partes.push(conteudo.items.map((i) => ("str" in i ? i.str : "")).join(" "));
  }
  return { paginas: doc.numPages, texto: partes.join(" ").replace(/\s+/g, " ").replace(/\.{4,}/g, " … ") };
}

async function infoXlsx(dados: Uint8Array): Promise<InfoAba[]> {
  const livro = await abrirXlsx(dados);
  const abas: InfoAba[] = [];
  for (const nome of livro.nomesAbas) {
    const aba = await livro.lerAba(nome);
    abas.push({
      nome,
      linhas: aba.linhas.length,
      colunas: aba.linhas.reduce((m, l) => Math.max(m, l.length), 0),
      amostra: amostraCabecalhos(aba.linhas, 6).map((l) => l.slice(0, 10)),
    });
  }
  return abas;
}

export async function inventariar(raiz: string): Promise<InfoArquivo[]> {
  const res: InfoArquivo[] = [];
  for (const caminho of listarArquivos(raiz)) {
    const dados = readFileSync(caminho);
    const tipo = extname(caminho).toLowerCase().replace(".", "");
    const info: InfoArquivo = { caminho: relative(raiz, caminho).replace(/\\/g, "/"), tipo, tamanhoBytes: dados.length };
    if (tipo === "xlsx") info.abas = await infoXlsx(dados);
    else if (tipo === "pdf") {
      const pdf = await lerPdf(dados);
      info.paginasPdf = pdf.paginas;
      info.textoPdf = pdf.texto.slice(0, 2500);
    }
    else if (tipo === "zip") info.conteudoZip = (await extrairXlsxDeZip(dados)).map((a) => a.nome);
    res.push(info);
  }
  return res;
}
