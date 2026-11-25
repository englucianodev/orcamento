/**
 * Parser dos relatórios SICRO (DNIT), layout por UF e mês: "PI 07-2026 Relatório ...xlsx".
 * Arquivos usados: Analítico de Composições (blocos A–F), Sintético de Equipamentos,
 * Sintético de Mão de Obra, Sintético de Materiais, Analítico de Encargos e Sintético de Composições.
 */
import type { Celula, Planilha } from "../xlsx-leitor";
import type {
  EncargosImportados, EquipamentoImportado, InsumoImportado,
} from "./tipos";
import { LayoutDesconhecidoError } from "./tipos";
import {
  amostraCabecalhos, localizarCabecalho, normalizar, numeroTexto, texto,
} from "./util";

export const LAYOUT_SICRO_2024 = "sicro-relatorios-2024";

export type TipoArquivoSicro =
  | "composicoes_analitico" | "composicoes_sintetico" | "equipamentos" | "mao_obra"
  | "materiais" | "encargos" | "ignorado";

export function identificarArquivoSicro(nomeArquivo: string, planilha: Planilha): TipoArquivoSicro {
  const primeira = normalizar(planilha.linhas[0]?.[0]);
  if (primeira.startsWith("sistema de custos referenciais")) return "composicoes_analitico";
  const topo = planilha.linhas.slice(0, 3).flat().map(normalizar).join(" | ");
  if (topo.includes("custo produtivo") && topo.includes("custo improdutivo")) return "equipamentos";
  if (topo.includes("encargos sociais (%)")) return "encargos";
  if (topo.includes("descricao do servico")) return "composicoes_sintetico";
  const nome = normalizar(nomeArquivo);
  if (nome.includes("sintetico de materiais")) return "materiais";
  if (nome.includes("sintetico de mao de obra")) return "mao_obra";
  return "ignorado";
}

export function arquivoComDesoneracao(nomeArquivo: string): boolean {
  return normalizar(nomeArquivo).includes("com desoneracao");
}

/** Códigos de composição SICRO têm 7 dígitos com zeros à esquerda. */
export function codigoSicro(valor: Celula | undefined): string {
  if (typeof valor === "number") return String(Math.trunc(valor)).padStart(7, "0");
  const s = texto(valor);
  return /^\d{1,7}$/.test(s) ? s.padStart(7, "0") : s;
}

function erro(planilha: Planilha, oQue: string): LayoutDesconhecidoError {
  return new LayoutDesconhecidoError(`Layout SICRO desconhecido em "${planilha.nome}": ${oQue}.`, amostraCabecalhos(planilha.linhas));
}

function lerTabelaSimples(
  planilha: Planilha, precoRotulo: string, prefixo: RegExp,
): { codigo: string; descricao: string; unidade: string; preco: string | null }[] {
  const cab = localizarCabecalho(planilha.linhas, {
    codigo: "Código", descricao: "Descrição", unidade: "Unidade", preco: precoRotulo,
  }, 5);
  if (!cab) throw erro(planilha, `cabeçalho "${precoRotulo}" não encontrado`);
  const c = (k: string): number => cab.colunas.get(k) ?? -1;
  return planilha.linhas.slice(cab.linha + 1)
    .filter((l) => prefixo.test(texto(l[c("codigo")])))
    .map((l) => ({
      codigo: texto(l[c("codigo")]), descricao: texto(l[c("descricao")]),
      unidade: texto(l[c("unidade")]), preco: numeroTexto(l[c("preco")]),
    }));
}

export function parseMateriaisSicro(planilha: Planilha): InsumoImportado[] {
  return lerTabelaSimples(planilha, "Preço Unitário", /^M\d/).map((m) => ({
    ...m, tipo: "MATERIAL", classificacao: "MATERIAL", origemPreco: null,
  }));
}

export function parseMaoObraSicro(planilha: Planilha): InsumoImportado[] {
  return lerTabelaSimples(planilha, "Custo", /^P\d/).map((m) => ({
    ...m, tipo: "MAO_OBRA", classificacao: "MÃO DE OBRA", origemPreco: null,
  }));
}

export function parseComposicoesSinteticoSicro(planilha: Planilha): Map<string, string | null> {
  const cab = localizarCabecalho(planilha.linhas, { codigo: "Código", custo: "Custo Unitário" }, 5);
  if (!cab) throw erro(planilha, "cabeçalho do sintético de composições não encontrado");
  const res = new Map<string, string | null>();
  for (const l of planilha.linhas.slice(cab.linha + 1)) {
    const codigo = codigoSicro(l[cab.colunas.get("codigo") ?? 0]);
    if (/^\d{7}$/.test(codigo)) res.set(codigo, numeroTexto(l[cab.colunas.get("custo") ?? 3]));
  }
  return res;
}

export function parseEquipamentosSicro(planilha: Planilha): { insumos: InsumoImportado[]; custos: EquipamentoImportado[] } {
  const cab = localizarCabecalho(planilha.linhas, {
    codigo: "Código", descricao: "Descrição", depreciacao: "Depreciação", juros: "Oportunidade de Capital",
    manutencao: "Manutenção", operacao: "Operação", mo: "Mão de Obra de Operação",
    chp: "Custo Produtivo", chi: "Custo Improdutivo",
  }, 5);
  if (!cab) throw erro(planilha, "cabeçalho de equipamentos não encontrado");
  const c = (k: string): number => cab.colunas.get(k) ?? -1;
  const insumos: InsumoImportado[] = [];
  const custos: EquipamentoImportado[] = [];
  for (const l of planilha.linhas.slice(cab.linha + 1)) {
    const codigo = texto(l[c("codigo")]);
    const chp = numeroTexto(l[c("chp")]);
    const chi = numeroTexto(l[c("chi")]);
    if (!/^E\d/.test(codigo) || chp === null || chi === null) continue;
    insumos.push({
      codigo, descricao: texto(l[c("descricao")]), unidade: "h", tipo: "EQUIPAMENTO",
      classificacao: "EQUIPAMENTO", preco: chp, origemPreco: null,
    });
    custos.push({
      codigo, chp, chi, depreciacao: numeroTexto(l[c("depreciacao")]), juros: numeroTexto(l[c("juros")]),
      manutencao: numeroTexto(l[c("manutencao")]), materiaisOperacao: numeroTexto(l[c("operacao")]),
      maoObraOperacao: numeroTexto(l[c("mo")]),
    });
  }
  return { insumos, custos };
}

function moda(valores: string[]): string | null {
  const cont = new Map<string, number>();
  for (const v of valores) cont.set(v, (cont.get(v) ?? 0) + 1);
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Encargos variam por profissão; guardamos o valor mais frequente de horistas e mensalistas. */
export function parseEncargosSicro(planilha: Planilha): EncargosImportados {
  const horista: string[] = [];
  const mensalista: string[] = [];
  for (const l of planilha.linhas.slice(2)) {
    const total = numeroTexto([...l].reverse().find((c) => c !== null));
    const unidade = normalizar(l[2]);
    if (!/^P\d/.test(texto(l[0])) || total === null) continue;
    if (unidade === "h") horista.push(total);
    else if (unidade === "mes") mensalista.push(total);
  }
  return { horistaPct: moda(horista), mensalistaPct: moda(mensalista) };
}
