/**
 * Leitor leve de arquivos .xlsx (JSZip + leitura direta do XML).
 * Funciona no navegador (Web Worker) e no Node (ferramentas e testes).
 * Evita carregar estilos e o modelo de objetos completo do exceljs, o que
 * permite abrir as planilhas oficiais do SINAPI (milhões de células) sem travar a aba.
 */
import JSZip from "jszip";

export type Celula = string | number | null;

export interface Planilha {
  nome: string;
  /** linhas[0] corresponde à linha 1 da planilha */
  linhas: Celula[][];
}

export interface LivroXlsx {
  nomesAbas: string[];
  lerAba(nome: string, opcoes?: { maxLinhas?: number }): Promise<Planilha>;
}

const ENTIDADES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
};

export function decodificarXml(texto: string): string {
  return texto
    .replace(/&(lt|gt|amp|quot|apos);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)));
}

export function colunaParaIndice(ref: string): number {
  const letras = ref.replace(/[0-9$]/g, "").toUpperCase();
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function atributo(attrs: string, nome: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${nome}="([^"]*)"`).exec(attrs);
  return m?.[1];
}

function textoDeSi(si: string): string {
  const semFonetica = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  const partes: string[] = [];
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(semFonetica)) !== null) partes.push(decodificarXml(m[1] ?? ""));
  return partes.join("");
}

export function lerStringsCompartilhadas(xml: string): string[] {
  const res: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>|<si\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) res.push(m[1] ? textoDeSi(m[1]) : "");
  return res;
}

/** Planilhas oficiais usam =HYPERLINK(...;codigo) na coluna de código, com valor em cache 0. */
const RE_HYPERLINK_ULTIMO_ARG = /HYPERLINK\([\s\S]*,\s*"?([0-9A-Za-z./-]+)"?\s*\)\s*$/;

function valorCelula(attrs: string, conteudo: string, strings: string[]): Celula {
  const tipo = atributo(attrs, "t");
  const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(conteudo)?.[1];
  if (formula) {
    const link = RE_HYPERLINK_ULTIMO_ARG.exec(decodificarXml(formula));
    if (link?.[1]) {
      const n = Number(link[1]);
      return Number.isFinite(n) && /^\d+$/.test(link[1]) ? n : link[1];
    }
  }
  if (tipo === "inlineStr") return textoDeSi(conteudo);
  const v = /<v>([\s\S]*?)<\/v>/.exec(conteudo)?.[1];
  if (v === undefined) return null;
  if (tipo === "s") return strings[Number(v)] ?? null;
  if (tipo === "str" || tipo === "e") return decodificarXml(v);
  if (tipo === "b") return v === "1" ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : decodificarXml(v);
}

export function lerLinhasDaAba(xml: string, strings: string[], maxLinhas?: number): Celula[][] {
  const linhas: Celula[][] = [];
  const reLinha = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  const reCel = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  let proxima = 1;
  while ((m = reLinha.exec(xml)) !== null) {
    const num = Number(atributo(m[1] ?? "", "r") ?? proxima);
    proxima = num + 1;
    if (maxLinhas !== undefined && num > maxLinhas) break;
    const linha: Celula[] = [];
    const corpo = m[2] ?? "";
    let c: RegExpExecArray | null;
    let col = 0;
    reCel.lastIndex = 0;
    while ((c = reCel.exec(corpo)) !== null) {
      const attrs = c[1] ?? "";
      const ref = atributo(attrs, "r");
      col = ref ? colunaParaIndice(ref) : col;
      const valor = valorCelula(attrs, c[2] ?? "", strings);
      if (valor !== null && valor !== "") linha[col] = valor;
      col += 1;
    }
    for (let i = 0; i < linha.length; i++) if (linha[i] === undefined) linha[i] = null;
    linhas[num - 1] = linha;
  }
  for (let i = 0; i < linhas.length; i++) if (!linhas[i]) linhas[i] = [];
  return linhas;
}

function caminhoAlvo(alvo: string): string {
  if (alvo.startsWith("/")) return alvo.slice(1);
  return `xl/${alvo}`.replace(/\/\.\//g, "/");
}

export async function abrirXlsx(dados: ArrayBuffer | Uint8Array): Promise<LivroXlsx> {
  const zip = await JSZip.loadAsync(dados);
  const livro = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!livro || !rels) throw new Error("Arquivo não é uma planilha .xlsx válida.");

  const alvos = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = atributo(m[1] ?? "", "Id");
    const alvo = atributo(m[1] ?? "", "Target");
    if (id && alvo) alvos.set(id, caminhoAlvo(alvo));
  }
  const abas = new Map<string, string>();
  for (const m of livro.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const nome = atributo(m[1] ?? "", "name");
    const rid = atributo(m[1] ?? "", "r:id");
    const caminho = rid ? alvos.get(rid) : undefined;
    if (nome && caminho) abas.set(decodificarXml(nome), caminho);
  }

  let strings: string[] | null = null;
  async function obterStrings(): Promise<string[]> {
    if (strings) return strings;
    const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
    strings = xml ? lerStringsCompartilhadas(xml) : [];
    return strings;
  }

  return {
    nomesAbas: [...abas.keys()],
    async lerAba(nome, opcoes) {
      const caminho = abas.get(nome);
      if (!caminho) throw new Error(`Aba "${nome}" não encontrada.`);
      const xml = await zip.file(caminho)?.async("string");
      if (xml === undefined) throw new Error(`Conteúdo da aba "${nome}" ausente.`);
      const linhas = lerLinhasDaAba(xml, await obterStrings(), opcoes?.maxLinhas);
      return { nome, linhas };
    },
  };
}

/** Extrai arquivos .xlsx de dentro de um .zip (downloads oficiais costumam vir compactados). */
export async function extrairXlsxDeZip(
  dados: ArrayBuffer | Uint8Array,
): Promise<{ nome: string; dados: Uint8Array }[]> {
  const zip = await JSZip.loadAsync(dados);
  const saida: { nome: string; dados: Uint8Array }[] = [];
  for (const arq of Object.values(zip.files)) {
    if (arq.dir || !/\.xlsx$/i.test(arq.name)) continue;
    saida.push({ nome: arq.name.split("/").pop() ?? arq.name, dados: await arq.async("uint8array") });
  }
  return saida;
}

export function ehZip(dados: Uint8Array): boolean {
  return dados[0] === 0x50 && dados[1] === 0x4b;
}
