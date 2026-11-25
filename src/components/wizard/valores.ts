/**
 * Modelo do formulário do assistente: rascunho salvo + padrões dos schemas, e validação por passo
 * com os MESMOS schemas Zod que o servidor usa.
 */
import { z } from "@/lib/zod-pt";
import {
  ambienteSchema, coberturaSchema, construcaoSchema, dadosGeraisSchema, entradaSchema, instalacoesSchema,
  lazerSchema, terrenoSchema, VERSAO_ENTRADA, type EntradaBruta,
} from "@/lib/engine/entrada.schema";
import { META_VAZIA, metaSchema, type MetaOrcamento } from "@/lib/orcamento/meta";

export interface ValoresAssistente {
  entrada: EntradaBruta;
  meta: MetaOrcamento;
}

export const PASSOS = [
  "Dados gerais", "Terreno", "Construção", "Ambientes", "Cobertura",
  "Instalações", "Lazer e externas", "Revisão dos quantitativos", "Orçamento", "Cronograma e relatórios",
] as const;
export const TOTAL_PASSOS = PASSOS.length;

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

/** Mescla profunda (objetos); listas e valores do rascunho substituem os padrões. */
export function mesclar<T>(padrao: T, salvo: unknown): T {
  if (!ehObjeto(padrao) || !ehObjeto(salvo)) return (salvo === undefined ? padrao : salvo) as T;
  const saida: Objeto = { ...padrao };
  for (const [k, v] of Object.entries(salvo)) saida[k] = k in padrao ? mesclar((padrao as Objeto)[k], v) : v;
  return saida as T;
}

function entradaPadrao(): EntradaBruta {
  return {
    versao: VERSAO_ENTRADA,
    dadosGerais: { nome: "", cliente: "", uf: "SP", municipio: "", mesBase: null, desonerado: false, padrao: "normal", pavimentos: 1 },
    // largura/profundidade do terreno ficam vazias até o usuário informar
    terreno: { ...terrenoSchema.omit({ largura: true, profundidade: true }).parse({}) } as EntradaBruta["terreno"],
    construcao: construcaoSchema.parse({}),
    ambientes: [],
    cobertura: coberturaSchema.parse({ telha: "ceramica" }),
    instalacoes: instalacoesSchema.parse({}),
    lazer: lazerSchema.parse({}),
  };
}

export function valoresIniciais(entradaSalva: unknown, meta: unknown): ValoresAssistente {
  const m = metaSchema.safeParse(meta);
  return { entrada: mesclar(entradaPadrao(), entradaSalva), meta: m.success ? m.data : META_VAZIA };
}

export interface ErroCampo {
  caminho: string;
  mensagem: string;
}

function erros(r: z.ZodSafeParseResult<unknown>, prefixo: string): ErroCampo[] {
  if (r.success) return [];
  return r.error.issues.map((i) => ({ caminho: [prefixo, ...i.path.map(String)].join("."), mensagem: i.message }));
}

const ambientesSchema = z.array(ambienteSchema).min(1, "Adicione pelo menos um ambiente.");

/** Valida os campos do passo (1 a 10). Lista vazia = pode avançar. */
export function validarPasso(passo: number, v: ValoresAssistente): ErroCampo[] {
  const e = v.entrada;
  switch (passo) {
    case 1: return [...erros(dadosGeraisSchema.safeParse(e.dadosGerais), "entrada.dadosGerais"), ...erros(metaSchema.safeParse(v.meta), "meta")];
    case 2: return erros(terrenoSchema.safeParse(e.terreno), "entrada.terreno");
    case 3: return erros(construcaoSchema.safeParse(e.construcao), "entrada.construcao");
    case 4: {
      const lista = erros(ambientesSchema.safeParse(e.ambientes), "entrada.ambientes");
      const pav = e.dadosGerais.pavimentos ?? 1;
      (e.ambientes ?? []).forEach((a, i) => {
        if ((a.pavimento ?? 1) > pav) lista.push({ caminho: `entrada.ambientes.${i}.pavimento`, mensagem: `A obra tem ${pav} pavimento(s).` });
      });
      return lista;
    }
    case 5: return erros(coberturaSchema.safeParse(e.cobertura), "entrada.cobertura");
    case 6: return erros(instalacoesSchema.safeParse(e.instalacoes), "entrada.instalacoes");
    case 7: return erros(lazerSchema.safeParse(e.lazer), "entrada.lazer");
    case 8: return erros(entradaSchema.safeParse(e), "entrada");
    case 9: return [...erros(entradaSchema.safeParse(e), "entrada"), ...erros(metaSchema.safeParse(v.meta), "meta")];
    default: return [];
  }
}

/** Passo em que um erro de caminho se resolve (para levar o usuário até ele). */
export function passoDoCaminho(caminho: string): number {
  const secoes: Array<[string, number]> = [
    ["entrada.dadosGerais", 1], ["entrada.terreno", 2], ["entrada.construcao", 3], ["entrada.ambientes", 4],
    ["entrada.cobertura", 5], ["entrada.instalacoes", 6], ["entrada.lazer", 7],
    // CUB, mês-base SICRO e responsável técnico aparecem no passo 1; DMT e BDI no passo 9
    ["meta.cub_m2", 1], ["meta.mes_base_sicro", 1], ["meta.responsavel", 1], ["meta", 9],
  ];
  return secoes.find(([p]) => caminho.startsWith(p))?.[1] ?? 1;
}

/** "" → null; "1,5" → 1.5 (campos numéricos do formulário). */
export function paraNumero(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isNaN(v) ? null : v;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function novoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
