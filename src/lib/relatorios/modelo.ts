/**
 * Modelo dos relatórios (seção 11): função PURA de `DadosOrcamento` (carregarOrcamento) + extras
 * buscados pela rota → objeto serializável com textos pt-BR e decimais para o Excel.
 * Valores ausentes viram "—" (nunca um número inventado).
 */
import type { DadosOrcamento, ItemDb } from "../orcamento/carregar";
import { ETAPAS, nomeEtapa } from "../engine/catalogo";
import { ZERO, decOuNull } from "../engine/decimal";
import type { LinhaFaixa } from "../orcamento/config";
import { fonteCodigo, montarComposicoes, type FechamentosRelatorio } from "./composicoes";
import { montarAbc, montarCronograma, montarEncargos, montarMemoria, montarQuadrosBdi, type LinhaEncargosDb } from "./secoes";
import {
  VAZIO, num, pct, type CabecalhoRelatorio, type EtapaSintetica, type Indicadores, type LinhaResumoEtapa,
  type LinhaSintetica, type ModeloRelatorio, type PlanilhaSintetica,
} from "./tipos";

export interface ExtrasRelatorio {
  /** data de emissão já formatada (ex.: "25/11/2026") */
  dataEmissao: string;
  composicoes?: FechamentosRelatorio;
  encargos?: readonly LinhaEncargosDb[];
  /** linhas da tabela `bdi_faixas` (percentuais) */
  faixas?: readonly LinhaFaixa[];
  avisos?: readonly string[];
}

const STATUS: Record<string, string> = { rascunho: "Rascunho", revisao: "Em revisão", aprovado: "Aprovado" };
const PADRAO: Record<string, string> = { baixo: "Baixo", normal: "Normal", alto: "Alto", luxo: "Luxo" };

const texto = (v: string | null | undefined): string => (v && v.trim() ? v.trim() : "—");

function mesAno(data: string | null): string | null {
  const m = data ? /^(\d{4})-(\d{2})/.exec(data) : null;
  return m ? `${m[2]}/${m[1]}` : null;
}

function datasBase(dados: DadosOrcamento): string[] {
  const { sinapi, sicro } = dados.bases;
  const rotulos = [sinapi?.rotulo, sicro?.rotulo].filter((r): r is string => Boolean(r));
  if (rotulos.length) return rotulos;
  const mes = mesAno(dados.orcamento.mes_base);
  return mes ? [`SINAPI ${dados.orcamento.uf ?? ""} ${mes} (base não importada)`.replace("  ", " ")] : [];
}

function responsavel(r: DadosOrcamento["orcamento"]["responsavel"]): CabecalhoRelatorio["responsavel"] {
  if (!r || !r.nome?.trim()) return null;
  return { nome: r.nome.trim(), registro: texto(r.registro), art: texto(r.art) };
}

function montarCabecalho(dados: DadosOrcamento, dataEmissao: string): CabecalhoRelatorio {
  const o = dados.orcamento;
  const geral = o.entrada?.dadosGerais;
  const padrao = o.padrao ?? geral?.padrao ?? null;
  return {
    empresa: { nome: dados.empresa.nome, cnpj: texto(dados.empresa.cnpj) },
    obra: o.nome,
    cliente: texto(o.cliente ?? geral?.cliente),
    uf: texto(o.uf),
    municipio: texto(geral?.municipio),
    padrao: padrao ? (PADRAO[padrao] ?? padrao) : "—",
    versao: o.versao,
    status: STATUS[o.status] ?? o.status,
    dataEmissao,
    datasBase: datasBase(dados),
    desoneracao: o.desonerado === null ? "—" : o.desonerado ? "Desonerado" : "Não desonerado",
    bdiServico: dados.bdi.servico ? pct(dados.bdi.taxaServico) : VAZIO,
    bdiMaterial: dados.bdi.material ? pct(dados.bdi.taxaMaterial) : VAZIO,
    responsavel: responsavel(o.responsavel),
  };
}

function linhaSintetica(item: ItemDb, calc: DadosOrcamento["resultado"]["itens"][number] | undefined): LinhaSintetica {
  const percentual = item.unidade === "%";
  const chave = item.fonte && item.codigo && !percentual ? fonteCodigo(item.fonte, item.codigo) : null;
  return {
    id: item.id,
    numero: texto(item.numero),
    fonteCodigo: fonteCodigo(item.fonte, item.codigo),
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade: num(calc?.quantidade ?? decOuNull(item.quantidade), 2, 4),
    custoUnitario: num(calc?.custoUnitario, 2, 4),
    precoUnitario: num(calc?.precoUnitario, 2, 4),
    custoTotal: calc && !calc.semComposicao ? num(calc.custoTotal) : VAZIO,
    total: calc && !calc.semComposicao ? num(calc.total) : VAZIO,
    bdiTipo: item.bdi_tipo === "material" ? "Material" : "Serviço",
    percentual,
    semComposicao: calc?.semComposicao ?? item.custo_unitario === null,
    alerta: item.alerta,
    chaveComposicao: chave,
  };
}

function ordemEtapas(itens: readonly ItemDb[]): string[] {
  const conhecidas: string[] = ETAPAS.map((e) => e.id);
  const extras = [...new Set(itens.map((i) => i.etapa))].filter((e) => !conhecidas.includes(e));
  return [...conhecidas, ...extras];
}

function montarSintetica(dados: DadosOrcamento): { planilha: PlanilhaSintetica; porId: Map<string, LinhaSintetica> } {
  const calc = new Map(dados.resultado.itens.map((i) => [i.id, i]));
  const porId = new Map(dados.itens.map((i) => [i.id, linhaSintetica(i, calc.get(i.id))]));
  const totais = new Map(dados.resultado.totaisEtapa.map((t) => [t.etapa, t]));
  const etapas = ordemEtapas(dados.itens).flatMap((id, pos): EtapaSintetica[] => {
    const itens = dados.itens.filter((i) => i.etapa === id).map((i) => porId.get(i.id)!);
    if (!itens.length) return [];
    const t = totais.get(id);
    return [{ id, ordem: pos + 1, nome: nomeEtapa(id), itens, custo: num(t?.custo ?? ZERO), subtotal: num(t?.total ?? ZERO) }];
  });
  return {
    planilha: {
      etapas, custoDireto: num(dados.resultado.custoDireto), total: num(dados.resultado.total),
      semComposicao: dados.resultado.semComposicao.length,
    },
    porId,
  };
}

function montarResumo(dados: DadosOrcamento, etapas: readonly EtapaSintetica[]): LinhaResumoEtapa[] {
  const total = dados.resultado.total;
  const totais = new Map(dados.resultado.totaisEtapa.map((t) => [t.etapa, t]));
  return etapas.map((e) => {
    const t = totais.get(e.id)?.total ?? ZERO;
    return { ordem: e.ordem, nome: e.nome, custo: e.custo, total: e.subtotal, percentual: total.isZero() ? VAZIO : pct(t.div(total)) };
  });
}

function montarIndicadores(dados: DadosOrcamento): Indicadores {
  const r = dados.resultado;
  const area = decOuNull(dados.orcamento.area_construida);
  const cub = decOuNull(dados.orcamento.cub_m2);
  const prazo = dados.cronograma.reduce((m, c) => Math.max(m, c.mes), 0);
  return {
    custoDireto: num(r.custoDireto),
    valorBdi: num(r.total.minus(r.custoDireto)),
    total: num(r.total),
    area: area && area.gt(0) ? num(area) : VAZIO,
    custoM2: num(r.custoM2),
    cub: cub && cub.gt(0) ? num(cub) : VAZIO,
    diferencaCub: pct(r.diferencaCub),
    prazoMeses: prazo > 0 ? prazo : null,
  };
}

function avisosGerais(dados: DadosOrcamento, extras: ExtrasRelatorio): string[] {
  const avisos = [...dados.bases.avisos, ...(extras.avisos ?? [])];
  const n = dados.resultado.semComposicao.length;
  if (n > 0) avisos.push(`${n} ${n === 1 ? "item sem composição" : "itens sem composição"}: valores não incluídos no total (marcados na planilha).`);
  return avisos;
}

export function montarModeloRelatorio(dados: DadosOrcamento, extras: ExtrasRelatorio): ModeloRelatorio {
  const { planilha, porId } = montarSintetica(dados);
  return {
    cabecalho: montarCabecalho(dados, extras.dataEmissao),
    sintetica: planilha,
    resumoEtapas: montarResumo(dados, planilha.etapas),
    indicadores: montarIndicadores(dados),
    abc: montarAbc(dados, porId),
    cronograma: montarCronograma(dados),
    bdi: { quadros: montarQuadrosBdi(dados, extras.faixas), encargos: montarEncargos(dados, extras.encargos ?? []) },
    memoria: montarMemoria(dados, porId),
    composicoes: montarComposicoes(dados, extras.composicoes ?? {}),
    avisos: avisosGerais(dados, extras),
  };
}

