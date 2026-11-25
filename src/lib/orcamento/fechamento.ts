/**
 * Converte o JSON da RPC `fechamento_composicoes` (composições pedidas + auxiliares + transportes,
 * com insumos e custos horários) numa "fonte de custo" que o orçamento consulta por código.
 * O JSON vem do banco: é validado com Zod antes de usar (dado externo).
 */
import { z } from "zod";
import { decOuNull, type Dec } from "../engine/decimal";
import { criarCalculadoraSinapi, type BaseCustoSinapi, type ItemSinapi } from "../engine/precos-sinapi";
import {
  criarCalculadoraSicro, type BaseCustoSicro, type ComposicaoSicro, type DmtObra, type ItemSicro,
} from "../engine/precos-sicro";

const numTexto = z.string().nullable();

export const fechamentoSchema = z.object({
  composicoes: z.array(z.object({
    codigo: z.string(), descricao: z.string().nullable(), unidade: z.string().nullable(), grupo: z.string().nullable(),
    preco_publicado: numTexto, producao_equipe: numTexto, fic: numTexto,
  })),
  itens: z.array(z.object({
    composicao_codigo: z.string(), tipo_item: z.enum(["INSUMO", "COMPOSICAO"]), item_codigo: z.string(),
    coeficiente: z.string(), utilizacao_operativa: numTexto, utilizacao_improdutiva: numTexto,
    grupo_sicro: z.enum(["A", "B", "C", "D", "E", "F"]).nullable(),
    extra: z.record(z.string(), z.string().nullable()).nullable(),
  })),
  insumos: z.array(z.object({
    codigo: z.string(), descricao: z.string().nullable(), unidade: z.string().nullable(), tipo: z.string().nullable(),
    preco: numTexto, origem_preco: z.string().nullable(), chp: numTexto, chi: numTexto,
  })),
});
export type Fechamento = z.infer<typeof fechamentoSchema>;

export interface CustoComposicao {
  custo: Dec | null;
  /** motivos de não haver custo (insumo sem preço, composição ausente...) */
  faltantes: string[];
}

export interface FonteCusto {
  fonte: "SINAPI" | "SICRO" | "PROPRIA";
  /** ex.: "SINAPI PI 10/2026 não desonerado" */
  rotulo: string;
  existe(codigo: string): boolean;
  descricao(codigo: string): { descricao: string; unidade: string } | null;
  custo(codigo: string): CustoComposicao;
}

function base(f: Fechamento) {
  const porCodigo = new Map(f.composicoes.map((c) => [c.codigo, c]));
  return {
    existe: (codigo: string) => porCodigo.has(codigo),
    descricao: (codigo: string) => {
      const c = porCodigo.get(codigo);
      return c ? { descricao: c.descricao ?? codigo, unidade: c.unidade ?? "" } : null;
    },
    publicado: (codigo: string) => decOuNull(porCodigo.get(codigo)?.preco_publicado ?? null),
  };
}

const ausente = (codigo: string): CustoComposicao => ({ custo: null, faltantes: [`composição ${codigo} não está na base`] });

export function baseSinapiDoFechamento(f: Fechamento): BaseCustoSinapi {
  const composicoes = new Map<string, ItemSinapi[]>(f.composicoes.map((c) => [c.codigo, []]));
  for (const it of f.itens) {
    composicoes.get(it.composicao_codigo)?.push({ tipo: it.tipo_item, codigo: it.item_codigo, coeficiente: it.coeficiente });
  }
  return { insumos: new Map(f.insumos.map((i) => [i.codigo, i.preco])), composicoes };
}

export function fonteSinapi(f: Fechamento, rotulo: string): FonteCusto {
  const b = base(f);
  const calc = criarCalculadoraSinapi(baseSinapiDoFechamento(f));
  return {
    fonte: "SINAPI", rotulo, existe: b.existe, descricao: b.descricao,
    custo(codigo) {
      if (!b.existe(codigo)) return ausente(codigo);
      const custo = calc.custo(codigo) ?? b.publicado(codigo);
      return { custo, faltantes: custo ? [] : calc.faltantes(codigo) };
    },
  };
}

export function baseSicroDoFechamento(f: Fechamento): BaseCustoSicro {
  const itens = new Map<string, ItemSicro[]>();
  for (const it of f.itens) {
    if (!it.grupo_sicro) continue;
    const lista = itens.get(it.composicao_codigo) ?? [];
    const ex = it.extra;
    lista.push({
      grupo: it.grupo_sicro, codigo: it.item_codigo, coeficiente: it.coeficiente,
      utilizacaoOperativa: it.utilizacao_operativa, utilizacaoImprodutiva: it.utilizacao_improdutiva,
      vias: it.grupo_sicro === "F" && ex ? { ln: ex.ln ?? undefined, rp: ex.rp ?? undefined, p: ex.p ?? undefined } : null,
    });
    itens.set(it.composicao_codigo, lista);
  }
  const composicoes = new Map<string, ComposicaoSicro>(f.composicoes.map((c) => [
    c.codigo, { producao: c.producao_equipe ?? "1", fic: c.fic, itens: itens.get(c.codigo) ?? [] },
  ]));
  const equipamentos = new Map<string, { chp: string; chi: string }>();
  for (const i of f.insumos) if (i.chp !== null && i.chi !== null) equipamentos.set(i.codigo, { chp: i.chp, chi: i.chi });
  return { equipamentos, insumos: new Map(f.insumos.map((i) => [i.codigo, i.preco])), composicoes };
}

export function fonteSicro(f: Fechamento, rotulo: string, dmt: DmtObra): FonteCusto {
  const b = base(f);
  const calc = criarCalculadoraSicro(baseSicroDoFechamento(f), { dmt });
  return {
    fonte: "SICRO", rotulo, existe: b.existe, descricao: b.descricao,
    custo(codigo) {
      if (!b.existe(codigo)) return ausente(codigo);
      const custo = calc.custo(codigo);
      return { custo, faltantes: custo ? [] : calc.faltantes(codigo) };
    },
  };
}

export interface ComposicaoPropria {
  codigo: string;
  descricao: string;
  unidade: string;
  custo: string | null;
}

/** Composições próprias da empresa: custo informado (sem abertura em insumos oficiais). */
export function fontePropria(lista: readonly ComposicaoPropria[]): FonteCusto {
  const m = new Map(lista.map((c) => [c.codigo, c]));
  return {
    fonte: "PROPRIA", rotulo: "Composições próprias",
    existe: (codigo) => m.has(codigo),
    descricao: (codigo) => {
      const c = m.get(codigo);
      return c ? { descricao: c.descricao, unidade: c.unidade } : null;
    },
    custo(codigo) {
      const c = m.get(codigo);
      if (!c) return ausente(codigo);
      const custo = decOuNull(c.custo);
      return { custo, faltantes: custo ? [] : [`composição própria ${codigo} sem custo informado`] };
    },
  };
}
