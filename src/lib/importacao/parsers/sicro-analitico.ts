/**
 * Leitura do "Relatório Analítico de Composições de Custos" do SICRO.
 * Cada composição é um bloco: cabeçalho (FIC, produção, unidade), código/descrição e as seções
 * A (equipamentos), B (mão de obra), C (material), D (atividades auxiliares),
 * E (tempo fixo) e F (momento de transporte), terminando em "Custo unitário direto total".
 */
import type { Celula, Planilha } from "../xlsx-leitor";
import type { ComposicaoImportada, EquipamentoImportado, GrupoSicro, InsumoImportado, ItemImportado } from "./tipos";
import { codigoSicro } from "./sicro-2024";
import { estadoParaUf, mesAnoParaData, normalizar, numeroTexto, texto } from "./util";

export interface ComposicoesAnaliticoSicro {
  uf: string | null;
  mesAno: string | null;
  composicoes: ComposicaoImportada[];
  itens: ItemImportado[];
  /** preços vistos dentro do analítico, usados quando faltam nos relatórios sintéticos */
  precosVistos: { insumos: InsumoImportado[]; equipamentos: EquipamentoImportado[] };
}

interface Estado {
  atual: ComposicaoImportada | null;
  secao: GrupoSicro | null;
  aguardandoCodigo: boolean;
  fic: string | null;
  producao: string | null;
  unidade: string;
}

function valorApos(linha: Celula[], rotulo: string): { valor: Celula; idx: number } | null {
  const idx = linha.findIndex((c) => normalizar(c).startsWith(rotulo));
  if (idx < 0) return null;
  const rel = linha.slice(idx + 1).findIndex((c) => c !== null);
  return rel < 0 ? null : { valor: linha[idx + 1 + rel] ?? null, idx: idx + 1 + rel };
}

function item(
  composicao: string, tipoItem: ItemImportado["tipoItem"], itemCodigo: string, coeficiente: string,
  grupo: GrupoSicro, extra: Partial<ItemImportado> = {},
): ItemImportado {
  return {
    composicaoCodigo: composicao, tipoItem, itemCodigo, coeficiente, utilizacaoOperativa: null,
    utilizacaoImprodutiva: null, grupoSicro: grupo, extra: null, ...extra,
  };
}

const SECOES: Record<string, GrupoSicro> = {
  "a - equipamentos": "A", "b - mao de obra": "B", "c - material": "C",
  "d - atividades auxiliares": "D", "e - tempo fixo": "E", "f - momento de transporte": "F",
};

export function parseAnaliticoSicro(planilha: Planilha): ComposicoesAnaliticoSicro {
  const res: ComposicoesAnaliticoSicro = {
    uf: null, mesAno: null, composicoes: [], itens: [], precosVistos: { insumos: [], equipamentos: [] },
  };
  const vistos = new Set<string>();
  const est: Estado = { atual: null, secao: null, aguardandoCodigo: false, fic: null, producao: null, unidade: "" };

  for (const linha of planilha.linhas) {
    const a = texto(linha[0]);
    const na = normalizar(a);
    if (na.startsWith("sistema de custos referenciais")) {
      res.uf ??= estadoParaUf(linha[3]);
      const fic = valorApos(linha, "fic");
      est.fic = fic ? numeroTexto(fic.valor) : null;
      est.atual = null;
      est.secao = null;
      continue;
    }
    if (na.startsWith("custo unitario de referencia")) {
      res.mesAno ??= mesAnoParaData(linha[3]);
      const prod = valorApos(linha, "producao da equipe");
      est.producao = prod ? numeroTexto(prod.valor) : null;
      est.unidade = prod ? texto(linha[prod.idx + 1]) : "";
      est.aguardandoCodigo = true;
      continue;
    }
    if (est.aguardandoCodigo && a) {
      est.atual = {
        codigo: codigoSicro(linha[0]), descricao: texto(linha[1]), unidade: est.unidade, grupo: null,
        precoPublicado: null, producaoEquipe: est.producao, fic: est.fic, fit: null,
      };
      res.composicoes.push(est.atual);
      est.aguardandoCodigo = false;
      continue;
    }
    if (!est.atual) continue;
    const secao = SECOES[na];
    if (secao) {
      est.secao = secao;
      continue;
    }
    const total = valorApos(linha, "custo unitario direto total");
    if (total) {
      est.atual.precoPublicado = numeroTexto(total.valor);
      continue;
    }
    if (a && est.secao) lerItem(linha, est.atual.codigo, est.secao, res, vistos);
  }
  return res;
}

function registrarPreco(res: ComposicoesAnaliticoSicro, vistos: Set<string>, ins: InsumoImportado): void {
  if (vistos.has(ins.codigo)) return;
  vistos.add(ins.codigo);
  res.precosVistos.insumos.push(ins);
}

function lerItem(
  linha: Celula[], comp: string, secao: GrupoSicro, res: ComposicoesAnaliticoSicro, vistos: Set<string>,
): void {
  const codigo = texto(linha[0]);
  const desc = texto(linha[1]);
  if (secao === "A") {
    const q = numeroTexto(linha[2]);
    const chp = numeroTexto(linha[5]);
    const chi = numeroTexto(linha[6]);
    if (!/^E\d/.test(codigo) || q === null) return;
    res.itens.push(item(comp, "INSUMO", codigo, q, "A", {
      utilizacaoOperativa: numeroTexto(linha[3]) ?? "0", utilizacaoImprodutiva: numeroTexto(linha[4]) ?? "0",
    }));
    if (chp !== null && chi !== null && !vistos.has(codigo)) {
      res.precosVistos.equipamentos.push({
        codigo, chp, chi, depreciacao: null, juros: null, manutencao: null, materiaisOperacao: null, maoObraOperacao: null,
      });
      registrarPreco(res, vistos, { codigo, descricao: desc, unidade: "h", tipo: "EQUIPAMENTO", classificacao: "EQUIPAMENTO", preco: chp, origemPreco: null });
    }
    return;
  }
  if (secao === "B" || secao === "C") {
    const q = numeroTexto(linha[2]);
    if (q === null) return;
    res.itens.push(item(comp, "INSUMO", codigo, q, secao));
    const mo = secao === "B";
    registrarPreco(res, vistos, {
      codigo, descricao: desc, unidade: texto(linha[3]), tipo: mo ? "MAO_OBRA" : "MATERIAL",
      classificacao: mo ? "MÃO DE OBRA" : "MATERIAL", preco: numeroTexto(linha[5]), origemPreco: null,
    });
    return;
  }
  if (secao === "D") {
    const q = numeroTexto(linha[2]);
    if (q !== null) res.itens.push(item(comp, "COMPOSICAO", codigoSicro(linha[0]), q, "D"));
    return;
  }
  if (secao === "E") {
    const q = numeroTexto(linha[3]);
    if (q !== null && linha[2] !== null) {
      res.itens.push(item(comp, "COMPOSICAO", codigoSicro(linha[2]), q, "E", { extra: { material: codigo } }));
    }
    return;
  }
  const q = numeroTexto(linha[2]);
  if (q === null || linha[4] === null) return;
  res.itens.push(item(comp, "COMPOSICAO", codigoSicro(linha[4]), q, "F", {
    extra: { material: codigo, ln: codigoSicro(linha[4]), rp: codigoSicro(linha[5]), p: codigoSicro(linha[6]) },
  }));
}
