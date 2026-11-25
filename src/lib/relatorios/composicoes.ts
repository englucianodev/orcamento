/**
 * Composições analíticas dos itens do orçamento, a partir do fechamento (RPC `fechamento_composicoes`)
 * de cada base. SINAPI: linhas consumo × preço; SICRO: itens por grupo + resumo do custo unitário.
 */
import type { DadosOrcamento } from "../orcamento/carregar";
import { D, decOuNull, type Dec } from "../engine/decimal";
import { criarCalculadoraSinapi } from "../engine/precos-sinapi";
import { criarCalculadoraSicro, type DetalheSicro } from "../engine/precos-sicro";
import { baseSicroDoFechamento, baseSinapiDoFechamento, type Fechamento } from "../orcamento/fechamento";
import { VAZIO, coef, num, type ComposicaoRelatorio, type LinhaComposicao } from "./tipos";

export interface FechamentosRelatorio {
  sinapi?: Fechamento | null;
  sicro?: Fechamento | null;
}

type FonteItem = "SINAPI" | "SICRO" | "PROPRIA";

const ROTULO_FONTE: Record<FonteItem, string> = { SINAPI: "SINAPI", SICRO: "SICRO", PROPRIA: "PRÓPRIA" };

export function fonteCodigo(fonte: FonteItem | null, codigo: string | null): string {
  return fonte && codigo ? `${ROTULO_FONTE[fonte]} ${codigo}` : "—";
}

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : "Erro ao abrir a composição.");

function catalogo(f: Fechamento) {
  const comps = new Map(f.composicoes.map((c) => [c.codigo, c]));
  const insumos = new Map(f.insumos.map((i) => [i.codigo, i]));
  const descrever = (codigo: string, ehComposicao: boolean) => {
    const c = ehComposicao ? comps.get(codigo) : insumos.get(codigo);
    return { descricao: c?.descricao ?? "—", unidade: c?.unidade ?? "—" };
  };
  return { comps, insumos, descrever };
}

function composicaoSinapi(f: Fechamento, codigo: string): ComposicaoRelatorio {
  const cat = catalogo(f);
  const cab = cat.comps.get(codigo);
  const chave = fonteCodigo("SINAPI", codigo);
  const base = { chave, fonteCodigo: chave, descricao: cab?.descricao ?? "—", unidade: cab?.unidade ?? "—", resumo: [] };
  if (!cab) return { ...base, custo: VAZIO, linhas: [], faltantes: [`Composição ${codigo} não está na base SINAPI selecionada.`] };
  try {
    const calc = criarCalculadoraSinapi(baseSinapiDoFechamento(f));
    const linhas = calc.analitica(codigo).map((l): LinhaComposicao => ({
      grupo: l.tipo, codigo: l.codigo, ...cat.descrever(l.codigo, l.tipo === "COMPOSICAO"),
      coeficiente: coef(l.coeficiente), precoUnitario: num(l.precoUnitario), total: num(l.total),
    }));
    const custo = calc.custo(codigo) ?? decOuNull(cab.preco_publicado);
    return { ...base, custo: num(custo), linhas, faltantes: calc.faltantes(codigo) };
  } catch (e) {
    return { ...base, custo: VAZIO, linhas: [], faltantes: [mensagem(e)] };
  }
}

function resumoSicro(d: DetalheSicro): ComposicaoRelatorio["resumo"] {
  const linha = (rotulo: string, v: Dec) => ({ rotulo, valor: num(v, 4) });
  return [
    linha("Custo horário de equipamentos", d.custoHorarioEquipamentos),
    linha("Custo horário de mão de obra", d.custoHorarioMaoObra),
    linha("Custo unitário de execução", d.custoExecucao),
    linha("Custo do FIC", d.custoFic),
    linha("Materiais (C)", d.custoMateriais),
    linha("Atividades auxiliares (D)", d.custoAtividadesAuxiliares),
    linha("Tempo fixo (E)", d.custoTempoFixo),
    linha("Momento de transporte (F)", d.custoTransporte),
    { rotulo: "Custo unitário direto total", valor: num(d.custoUnitario) },
  ];
}

function composicaoSicro(f: Fechamento, codigo: string, dmt: DadosOrcamento["orcamento"]["dmt"]): ComposicaoRelatorio {
  const cat = catalogo(f);
  const cab = cat.comps.get(codigo);
  const chave = fonteCodigo("SICRO", codigo);
  const base = { chave, fonteCodigo: chave, descricao: cab?.descricao ?? "—", unidade: cab?.unidade ?? "—" };
  if (!cab) return { ...base, custo: VAZIO, linhas: [], resumo: [], faltantes: [`Composição ${codigo} não está na base SICRO selecionada.`] };
  const linhas = f.itens.filter((i) => i.composicao_codigo === codigo && i.grupo_sicro).map((i): LinhaComposicao => {
    const preco = i.grupo_sicro === "C" ? decOuNull(cat.insumos.get(i.item_codigo)?.preco ?? null) : null;
    return {
      grupo: i.grupo_sicro ?? "—", codigo: i.item_codigo, ...cat.descrever(i.item_codigo, i.tipo_item === "COMPOSICAO"),
      coeficiente: coef(new D(i.coeficiente)), precoUnitario: num(preco, 4), total: VAZIO,
    };
  });
  try {
    const calc = criarCalculadoraSicro(baseSicroDoFechamento(f), { dmt: dmt ?? { ln: 0, rp: 0, p: 0 } });
    const detalhe = calc.detalhe(codigo);
    return {
      ...base, custo: num(detalhe?.custoUnitario), linhas,
      resumo: detalhe ? resumoSicro(detalhe) : [], faltantes: calc.faltantes(codigo),
    };
  } catch (e) {
    return { ...base, custo: VAZIO, linhas, resumo: [], faltantes: [mensagem(e)] };
  }
}

function composicaoPropria(codigo: string, item: DadosOrcamento["itens"][number]): ComposicaoRelatorio {
  const chave = fonteCodigo("PROPRIA", codigo);
  return {
    chave, fonteCodigo: chave, descricao: item.descricao, unidade: item.unidade,
    custo: num(decOuNull(item.custo_unitario), 2, 4), linhas: [], resumo: [],
    faltantes: ["Composição própria da empresa: custo informado, sem abertura em insumos oficiais."],
  };
}

/** Uma composição por (fonte, código) usada nos itens, na ordem da planilha. */
export function montarComposicoes(dados: DadosOrcamento, fech: FechamentosRelatorio): ComposicaoRelatorio[] {
  const vistas = new Set<string>();
  const lista: ComposicaoRelatorio[] = [];
  for (const item of dados.itens) {
    if (!item.fonte || !item.codigo || item.unidade === "%") continue;
    const chave = fonteCodigo(item.fonte, item.codigo);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    if (item.fonte === "SINAPI" && fech.sinapi) lista.push(composicaoSinapi(fech.sinapi, item.codigo));
    else if (item.fonte === "SICRO" && fech.sicro) lista.push(composicaoSicro(fech.sicro, item.codigo, dados.orcamento.dmt));
    else if (item.fonte === "PROPRIA") lista.push(composicaoPropria(item.codigo, item));
  }
  return lista;
}
