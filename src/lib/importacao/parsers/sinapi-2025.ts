/**
 * Parser do layout SINAPI "Referência" (a partir de 2025): um único arquivo
 * SINAPI_Referência_AAAA_MM.xlsx com todas as UFs em colunas.
 * Abas: ISD/ICD (insumos sem/com desoneração), CSD/CCD (composições), Analítico (itens).
 * Layout documentado em docs/ANALISE_REFERENCIAS.md.
 */
import type { Celula, LivroXlsx, Planilha } from "../xlsx-leitor";
import type {
  BaseImportada, ComposicaoImportada, EncargosImportados, InsumoImportado, ItemImportado, TipoInsumo,
} from "./tipos";
import { LayoutDesconhecidoError } from "./tipos";
import {
  amostraCabecalhos, codigoTexto, localizarCabecalho, mesAnoParaData, normalizar, numeroTexto, texto, type UF,
} from "./util";

export const LAYOUT_SINAPI_2025 = "sinapi-referencia-2025";
/**
 * Metodologia SINAPI (%AS): insumo sem coleta mínima na UF usa o preço de São Paulo
 * no cálculo das composições. Marcamos a origem como "AS" para a interface avisar.
 */
const UF_ATRIBUICAO = "SP";
export const ORIGEM_ATRIBUIDO_SP = "AS";
const ABAS_OBRIGATORIAS = ["ISD", "ICD", "CSD", "CCD", "Analítico"];

export function detectarSinapi2025(nomesAbas: string[]): boolean {
  const nomes = new Set(nomesAbas.map((n) => normalizar(n)));
  return ABAS_OBRIGATORIAS.every((a) => nomes.has(normalizar(a)));
}

export function classificarInsumo(classificacao: string): TipoInsumo {
  const c = normalizar(classificacao);
  if (c.startsWith("material")) return "MATERIAL";
  if (c.startsWith("mao de obra") || c.startsWith("encargos complementares")) return "MAO_OBRA";
  if (c.startsWith("equipamento")) return "EQUIPAMENTO";
  if (c.startsWith("transporte")) return "TRANSPORTE";
  return "SERVICO";
}

function erroLayout(planilha: Planilha, oQue: string): LayoutDesconhecidoError {
  return new LayoutDesconhecidoError(
    `Layout SINAPI desconhecido na aba "${planilha.nome}": ${oQue}.`,
    amostraCabecalhos(planilha.linhas),
  );
}

export function lerMesReferencia(planilha: Planilha): string | null {
  for (const linha of planilha.linhas.slice(0, 10)) {
    const idx = linha.findIndex((c) => normalizar(c).startsWith("mes de referencia"));
    if (idx >= 0) {
      const valor = linha.slice(idx + 1).find((c) => c !== null);
      return mesAnoParaData(valor);
    }
  }
  return null;
}

export function parseInsumosSinapi(planilha: Planilha, uf: UF): InsumoImportado[] {
  const cab = localizarCabecalho(planilha.linhas, {
    classificacao: "Classificação", codigo: "Código do Insumo", descricao: "Descrição do Insumo",
    unidade: "Unidade", origem: "Origem de Preço",
  });
  if (!cab) throw erroLayout(planilha, "cabeçalho de insumos não encontrado");
  const cabecalho = planilha.linhas[cab.linha] ?? [];
  const colUf = cabecalho.findIndex((c) => texto(c) === uf);
  const colSp = cabecalho.findIndex((c) => texto(c) === UF_ATRIBUICAO);
  if (colUf < 0) throw erroLayout(planilha, `coluna da UF ${uf} não encontrada`);
  const col = (k: string): number => cab.colunas.get(k) ?? -1;
  const saida: InsumoImportado[] = [];
  for (const linha of planilha.linhas.slice(cab.linha + 1)) {
    const codigo = codigoTexto(linha[col("codigo")]);
    if (!/^\d+$/.test(codigo)) continue;
    const classificacao = texto(linha[col("classificacao")]);
    const precoUf = numeroTexto(linha[colUf]);
    const precoSp = colSp >= 0 ? numeroTexto(linha[colSp]) : null;
    const atribuido = precoUf === null && precoSp !== null;
    saida.push({
      codigo,
      descricao: texto(linha[col("descricao")]),
      unidade: texto(linha[col("unidade")]),
      tipo: classificarInsumo(classificacao),
      classificacao,
      preco: atribuido ? precoSp : precoUf,
      origemPreco: atribuido ? ORIGEM_ATRIBUIDO_SP : texto(linha[col("origem")]) || null,
    });
  }
  return saida;
}

/** Nas abas CSD/CCD a UF fica na linha acima do cabeçalho; cada UF ocupa "Custo (R$)" e "%AS". */
export function parseComposicoesSinapi(planilha: Planilha, uf: UF): ComposicaoImportada[] {
  const cab = localizarCabecalho(planilha.linhas, {
    grupo: "Grupo", codigo: "Código da Composição", descricao: "Descrição", unidade: "Unidade",
  });
  if (!cab) throw erroLayout(planilha, "cabeçalho de composições não encontrado");
  const linhaUf = planilha.linhas[cab.linha - 1] ?? [];
  const colUf = linhaUf.findIndex((c) => texto(c) === uf);
  if (colUf < 0) throw erroLayout(planilha, `coluna da UF ${uf} não encontrada`);
  const col = (k: string): number => cab.colunas.get(k) ?? -1;
  const saida: ComposicaoImportada[] = [];
  for (const linha of planilha.linhas.slice(cab.linha + 1)) {
    const codigo = codigoTexto(linha[col("codigo")]);
    if (!/^\d+$/.test(codigo) || codigo === "0") continue;
    saida.push({
      codigo,
      descricao: texto(linha[col("descricao")]),
      unidade: texto(linha[col("unidade")]),
      grupo: texto(linha[col("grupo")]) || null,
      // custo 0 = composição "SEM CUSTO" / "EM ESTUDO" na publicação
      precoPublicado: Number(numeroTexto(linha[colUf]) ?? 0) === 0 ? null : numeroTexto(linha[colUf]),
      producaoEquipe: null,
      fic: null,
      fit: null,
    });
  }
  return saida;
}

export function parseAnaliticoSinapi(planilha: Planilha): ItemImportado[] {
  const cab = localizarCabecalho(planilha.linhas, {
    composicao: "Código da Composição", tipo: "Tipo Item", item: "Código do Item", coeficiente: "Coeficiente",
  });
  if (!cab) throw erroLayout(planilha, "cabeçalho do analítico não encontrado");
  const col = (k: string): number => cab.colunas.get(k) ?? -1;
  const saida: ItemImportado[] = [];
  for (const linha of planilha.linhas.slice(cab.linha + 1)) {
    const tipo = normalizar(linha[col("tipo")]);
    if (tipo !== "insumo" && tipo !== "composicao") continue;
    const coeficiente = numeroTexto(linha[col("coeficiente")]);
    if (coeficiente === null) continue;
    saida.push({
      composicaoCodigo: codigoTexto(linha[col("composicao")]),
      tipoItem: tipo === "insumo" ? "INSUMO" : "COMPOSICAO",
      itemCodigo: codigoTexto(linha[col("item")]),
      coeficiente,
      utilizacaoOperativa: null,
      utilizacaoImprodutiva: null,
      grupoSicro: null,
      extra: null,
    });
  }
  return saida;
}

function linhaDoRotulo(linhas: Celula[][], rotulo: string): { linha: number; col: number } | null {
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const col = (linhas[i] ?? []).findIndex((c) => normalizar(c) === rotulo);
    if (col >= 0) return { linha: i, col };
  }
  return null;
}

/** Encargos (fator, ex.: 1,1261 = 112,61%) ficam nas linhas "Horista" e "Mensalista" do topo da aba. */
export function parseEncargosSinapi(planilha: Planilha, uf: UF): EncargosImportados {
  const horista = linhaDoRotulo(planilha.linhas, "horista");
  const mensalista = linhaDoRotulo(planilha.linhas, "mensalista");
  let colUf = -1;
  for (let i = 0; i < Math.min(15, planilha.linhas.length) && colUf < 0; i++) {
    const linha = planilha.linhas[i] ?? [];
    if (linha.filter((c) => /^[A-Z]{2}$/.test(texto(c))).length >= 20) colUf = linha.findIndex((c) => texto(c) === uf);
  }
  const pct = (pos: { linha: number } | null): string | null => {
    if (!pos || colUf < 0) return null;
    const v = numeroTexto(planilha.linhas[pos.linha]?.[colUf]);
    return v === null ? null : String(Number((Number(v) * 100).toFixed(4)));
  };
  return { horistaPct: pct(horista), mensalistaPct: pct(mensalista) };
}

export interface OpcoesSinapi {
  uf: UF;
  desonerado: boolean;
  aoProgredir?: (etapa: string) => void;
}

export async function lerSinapi2025(livro: LivroXlsx, opcoes: OpcoesSinapi): Promise<BaseImportada> {
  const sufixo = opcoes.desonerado ? "CD" : "SD";
  const nomeAba = (alvo: string): string =>
    livro.nomesAbas.find((n) => normalizar(n) === normalizar(alvo)) ?? alvo;
  opcoes.aoProgredir?.("insumos");
  const abaInsumos = await livro.lerAba(nomeAba(`I${sufixo}`));
  const insumos = parseInsumosSinapi(abaInsumos, opcoes.uf);
  const encargos = parseEncargosSinapi(abaInsumos, opcoes.uf);
  const mesAno = lerMesReferencia(abaInsumos);
  opcoes.aoProgredir?.("composicoes");
  const composicoes = parseComposicoesSinapi(await livro.lerAba(nomeAba(`C${sufixo}`)), opcoes.uf);
  opcoes.aoProgredir?.("itens");
  const itens = parseAnaliticoSinapi(await livro.lerAba(nomeAba("Analítico")));
  if (!mesAno) throw new Error("Mês de referência não encontrado na planilha SINAPI.");
  const avisos: string[] = [];
  const atribuidos = insumos.filter((i) => i.origemPreco === ORIGEM_ATRIBUIDO_SP).length;
  if (atribuidos > 0) avisos.push(`${atribuidos} insumos sem coleta em ${opcoes.uf} usam o preço de SP (%AS).`);
  const semPreco = insumos.filter((i) => i.preco === null).length;
  if (semPreco > 0) avisos.push(`${semPreco} insumos sem preço nem em ${opcoes.uf} nem em SP.`);
  return {
    fonte: "SINAPI", layout: LAYOUT_SINAPI_2025, uf: opcoes.uf, mesAno, desonerado: opcoes.desonerado,
    insumos, equipamentos: [], composicoes, itens, encargos, avisos,
  };
}
