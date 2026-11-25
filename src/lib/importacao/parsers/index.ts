/**
 * Registro de parsers por versão de layout. Para suportar um novo layout oficial, crie um
 * arquivo de parser e adicione-o aqui. Layout desconhecido → LayoutDesconhecidoError com os
 * cabeçalhos encontrados, para o administrador ver o que mudou.
 */
import type { LivroXlsx } from "../xlsx-leitor";
import type { BaseImportada, EquipamentoImportado, InsumoImportado } from "./tipos";
import { LayoutDesconhecidoError } from "./tipos";
import { detectarSinapi2025, lerSinapi2025 } from "./sinapi-2025";
import {
  LAYOUT_SICRO_2024, arquivoComDesoneracao, identificarArquivoSicro, parseComposicoesSinteticoSicro,
  parseEncargosSicro, parseEquipamentosSicro, parseMaoObraSicro, parseMateriaisSicro, type TipoArquivoSicro,
} from "./sicro-2024";
import { parseAnaliticoSicro } from "./sicro-analitico";
import { amostraCabecalhos, type UF } from "./util";

export interface ArquivoLido {
  nome: string;
  livro: LivroXlsx;
}

export interface OpcoesLeitura {
  fonte: "SINAPI" | "SICRO";
  uf: UF;
  desonerado: boolean;
  aoProgredir?: (etapa: string) => void;
}

export async function lerArquivosOficiais(arquivos: ArquivoLido[], opcoes: OpcoesLeitura): Promise<BaseImportada> {
  if (arquivos.length === 0) throw new Error("Nenhuma planilha .xlsx encontrada no envio.");
  if (opcoes.fonte === "SINAPI") {
    const ref = arquivos.find((a) => detectarSinapi2025(a.livro.nomesAbas));
    if (!ref) {
      const primeiro = arquivos[0] as ArquivoLido;
      const aba = await primeiro.livro.lerAba(primeiro.livro.nomesAbas[0] ?? "", { maxLinhas: 40 });
      throw new LayoutDesconhecidoError(
        `Layout SINAPI desconhecido. Abas encontradas: ${primeiro.livro.nomesAbas.join(", ")}.`,
        amostraCabecalhos(aba.linhas),
      );
    }
    return lerSinapi2025(ref.livro, opcoes);
  }
  return montarBaseSicro(arquivos, opcoes);
}

interface ArquivoSicro extends ArquivoLido {
  tipo: TipoArquivoSicro;
  desonerado: boolean;
}

async function classificar(arquivos: ArquivoLido[]): Promise<ArquivoSicro[]> {
  const res: ArquivoSicro[] = [];
  for (const a of arquivos) {
    const aba = await a.livro.lerAba(a.livro.nomesAbas[0] ?? "", { maxLinhas: 5 });
    res.push({ ...a, tipo: identificarArquivoSicro(a.nome, aba), desonerado: arquivoComDesoneracao(a.nome) });
  }
  return res;
}

/** Escolhe a variante (com/sem desoneração) pedida; se só houver uma, usa a disponível. */
function escolher(arqs: ArquivoSicro[], tipo: TipoArquivoSicro, desonerado: boolean): ArquivoSicro | undefined {
  const doTipo = arqs.filter((a) => a.tipo === tipo);
  return doTipo.find((a) => a.desonerado === desonerado) ?? doTipo[0];
}

async function primeiraAba(a: ArquivoLido) {
  return a.livro.lerAba(a.livro.nomesAbas[0] ?? "");
}

export async function montarBaseSicro(arquivos: ArquivoLido[], opcoes: OpcoesLeitura): Promise<BaseImportada> {
  const arqs = await classificar(arquivos);
  const analitico = escolher(arqs, "composicoes_analitico", false);
  if (!analitico) {
    const aba = await primeiraAba(arquivos[0] as ArquivoLido);
    throw new LayoutDesconhecidoError(
      "Relatório Analítico de Composições do SICRO não encontrado entre os arquivos enviados.",
      amostraCabecalhos(aba.linhas),
    );
  }
  const avisos: string[] = [];
  opcoes.aoProgredir?.("composicoes");
  const an = parseAnaliticoSicro(await primeiraAba(analitico));
  if (an.uf && an.uf !== opcoes.uf) throw new Error(`O arquivo é da UF ${an.uf}, mas foi escolhida ${opcoes.uf}.`);
  if (!an.mesAno) throw new Error("Mês de referência não encontrado no analítico do SICRO.");

  opcoes.aoProgredir?.("insumos");
  const insumos = new Map<string, InsumoImportado>(an.precosVistos.insumos.map((i) => [i.codigo, i]));
  const equipamentos = new Map<string, EquipamentoImportado>(an.precosVistos.equipamentos.map((e) => [e.codigo, e]));
  const usar = async (tipo: TipoArquivoSicro): Promise<ArquivoSicro | undefined> => {
    const a = escolher(arqs, tipo, opcoes.desonerado);
    if (!a) avisos.push(`Relatório "${tipo}" ausente: usados os preços que constam no analítico.`);
    else if (a.desonerado !== opcoes.desonerado && tipo !== "materiais") {
      avisos.push(`Relatório "${tipo}" na variante ${a.desonerado ? "com" : "sem"} desoneração (a pedida não foi enviada).`);
    }
    return a;
  };
  const mat = await usar("materiais");
  if (mat) for (const i of parseMateriaisSicro(await primeiraAba(mat))) insumos.set(i.codigo, i);
  const mo = await usar("mao_obra");
  if (mo) for (const i of parseMaoObraSicro(await primeiraAba(mo))) insumos.set(i.codigo, i);
  const eq = await usar("equipamentos");
  if (eq) {
    const lido = parseEquipamentosSicro(await primeiraAba(eq));
    for (const i of lido.insumos) insumos.set(i.codigo, i);
    for (const c of lido.custos) equipamentos.set(c.codigo, c);
  }
  const enc = await usar("encargos");
  const encargos = enc ? parseEncargosSicro(await primeiraAba(enc)) : { horistaPct: null, mensalistaPct: null };

  const sint = escolher(arqs, "composicoes_sintetico", false);
  const precosSint = sint ? parseComposicoesSinteticoSicro(await primeiraAba(sint)) : new Map<string, string | null>();
  const composicoes = an.composicoes.map((c) => ({
    ...c,
    precoPublicado: opcoes.desonerado ? null : (c.precoPublicado ?? precosSint.get(c.codigo) ?? null),
  }));
  if (opcoes.desonerado) {
    avisos.push("O DNIT publica o analítico de composições só sem desoneração: os custos desonerados são recalculados pelo motor.");
  }
  return {
    fonte: "SICRO", layout: LAYOUT_SICRO_2024, uf: opcoes.uf, mesAno: an.mesAno, desonerado: opcoes.desonerado,
    insumos: [...insumos.values()], equipamentos: [...equipamentos.values()], composicoes, itens: an.itens, encargos, avisos,
  };
}

export { LayoutDesconhecidoError };
