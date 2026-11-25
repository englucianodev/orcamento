/**
 * Ferramenta de desenvolvimento da Fase 0 (não faz parte do sistema web).
 * Uso: npm run analisar-referencias
 * Gera docs/ANALISE_REFERENCIAS.gerado.md (dados brutos) e fixtures em tests/fixtures/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { abrirXlsx } from "../src/lib/importacao/xlsx-leitor";
import { lerArquivosOficiais, type ArquivoLido } from "../src/lib/importacao/parsers";
import type { BaseImportada } from "../src/lib/importacao/parsers/tipos";
import { UFS, type UF } from "../src/lib/importacao/parsers/util";
import { inventariar, listarArquivos, type InfoArquivo } from "./analise/inventario";
import { validar, type ResultadoValidacao } from "./analise/validacao";
import { fechamento, recorte } from "./analise/fixtures";

const RAIZ = "referencias";
const saida: string[] = [];
const out = (s = ""): void => {
  saida.push(s);
};

function secaoInventario(inv: InfoArquivo[]): void {
  out("## 1. Inventário");
  out("| Arquivo | Tipo | Tamanho | Abas (linhas × colunas) / páginas |");
  out("|---|---|---:|---|");
  for (const a of inv) {
    const det = a.abas?.map((x) => `${x.nome} (${x.linhas}×${x.colunas})`).join("; ") ?? (a.paginasPdf ? `${a.paginasPdf} páginas` : "");
    out(`| ${a.caminho} | ${a.tipo} | ${(a.tamanhoBytes / 1e6).toFixed(2)} MB | ${det} |`);
  }
  out();
  for (const a of inv.filter((x) => x.textoPdf)) {
    out(`### ${a.caminho} (início do texto extraído)`);
    out(`> ${a.textoPdf}`);
    out();
  }
  out("### Amostras de cabeçalho");
  for (const a of inv.filter((x) => x.abas)) {
    out(`#### ${a.caminho}`);
    for (const aba of a.abas ?? []) {
      out(`- **${aba.nome}**`);
      for (const l of aba.amostra) out(`  - \`${l.join(" | ")}\``);
    }
  }
}

function linhaValidacao(rotulo: string, base: BaseImportada, v: ResultadoValidacao): string {
  const pct = v.comparadas ? ((v.conferem / v.comparadas) * 100).toFixed(2) : "—";
  const ex = v.divergentes.slice(0, 3).map((d) => `${d.codigo}: ${d.calculado} × ${d.publicado}`).join("; ");
  return `| ${rotulo} | ${base.insumos.length} | ${base.composicoes.length} | ${base.itens.length} | ${base.encargos.horistaPct ?? "—"} / ${base.encargos.mensalistaPct ?? "—"} | ${v.comparadas} | ${v.conferem} (${pct}%) | ${v.semCusto} | ${ex} |`;
}

async function ler(caminhos: string[]): Promise<ArquivoLido[]> {
  return Promise.all(caminhos.map(async (c) => ({ nome: basename(c), livro: await abrirXlsx(readFileSync(c)) })));
}

function salvarFixture(nome: string, dados: unknown): void {
  mkdirSync("tests/fixtures", { recursive: true });
  writeFileSync(join("tests/fixtures", nome), `${JSON.stringify(dados, null, 1)}\n`);
}

async function analisarSinapi(arquivos: string[]): Promise<void> {
  const ref = arquivos.find((a) => /SINAPI_Refer/i.test(a));
  if (!ref) return;
  out("## 2. SINAPI — validação por recálculo (todas as UFs)");
  out("| UF / regime | Insumos | Composições | Itens | Encargos horista/mensalista (%) | Comparadas | Conferem ±0,01 | Sem custo | Exemplos de divergência |");
  out("|---|---:|---:|---:|---|---:|---:|---:|---|");
  const lidos = await ler([ref]);
  for (const uf of UFS) {
    for (const desonerado of [false, true]) {
      const base = await lerArquivosOficiais(lidos, { fonte: "SINAPI", uf: uf as UF, desonerado });
      out(linhaValidacao(`${uf} ${desonerado ? "desonerado" : "não desonerado"}`, base, validar(base)));
      if (uf === "PI" && !desonerado) {
        salvarFixture("sinapi-pi-2026-10-amostra.json", fechamento(base, ["104658", "87879", "103328", "94971", "92873"]));
        const livro = lidos[0]?.livro;
        if (livro) {
          salvarFixture("sinapi-aba-isd-recorte.json", recorte(await livro.lerAba("ISD"), 60));
          salvarFixture("sinapi-aba-csd-recorte.json", recorte(await livro.lerAba("CSD"), 40, 60));
          salvarFixture("sinapi-aba-analitico-recorte.json", recorte(await livro.lerAba("Analítico"), 60));
        }
      }
    }
  }
  out();
}

async function analisarSicro(arquivos: string[]): Promise<void> {
  const sicro = arquivos.filter((a) => /sicro/i.test(a) && a.endsWith(".xlsx"));
  if (!sicro.length) return;
  out("## 3. SICRO — validação por recálculo");
  out("| UF / regime | Insumos | Composições | Itens | Encargos horista/mensalista (%) | Comparadas | Conferem ±0,01 | Sem custo | Exemplos de divergência |");
  out("|---|---:|---:|---:|---|---:|---:|---:|---|");
  const lidos = await ler(sicro);
  for (const desonerado of [false, true]) {
    const base = await lerArquivosOficiais(lidos, { fonte: "SICRO", uf: "PI", desonerado });
    const v = validar(base);
    out(linhaValidacao(`PI ${desonerado ? "desonerado" : "não desonerado"}`, base, v));
    if (!desonerado) {
      salvarFixture("sicro-pi-2026-07-amostra.json", fechamento(base, ["0308308", "0407819", "0307084"]));
      for (const a of base.avisos) out(`> Aviso: ${a}`);
      out();
      out(`Divergências (até 15 de ${v.divergentes.length}):`);
      for (const d of v.divergentes.slice(0, 15)) out(`- ${d.codigo}: calculado ${d.calculado} × publicado ${d.publicado}`);
    } else for (const a of base.avisos) out(`> Aviso: ${a}`);
  }
  out();
}

async function main(): Promise<void> {
  const inicio = Date.now();
  out("# Análise das referências — dados gerados automaticamente");
  out(`Gerado por \`tools/analisar-referencias.ts\` em ${new Date().toISOString().slice(0, 10)}.`);
  out();
  secaoInventario(await inventariar(RAIZ));
  const arquivos = listarArquivos(RAIZ);
  await analisarSinapi(arquivos);
  await analisarSicro(arquivos);
  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/ANALISE_REFERENCIAS.gerado.md", `${saida.join("\n")}\n`);
  console.log(`Concluído em ${((Date.now() - inicio) / 1000).toFixed(1)} s → docs/ANALISE_REFERENCIAS.gerado.md`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
