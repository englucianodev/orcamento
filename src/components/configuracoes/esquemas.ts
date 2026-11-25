/**
 * Schemas Zod dos formulários de Configurações. Os mesmos schemas validam no navegador e nas
 * server actions. Valores decimais circulam como texto (ver decimais.ts).
 */
import { z } from "zod";
import { calcularBdi } from "@/lib/engine/bdi";
import {
  MATERIAIS_JANELA, MATERIAIS_PORTA, PADROES, TIPOS_FORRO, TIPOS_PINTURA, TIPOS_PISO, TIPOS_REVESTIMENTO_PAREDE,
} from "@/lib/engine/entrada.schema";
import type { ConfigPadrao } from "@/lib/engine/padroes";
import { decimalTexto, percentualParaFracao } from "./decimais";

const vazioParaNull = (v: unknown): unknown => (v === "" || v === undefined || v === null ? null : v);
const codigoComposicao = z.string().trim()
  .min(1, "Informe o código da composição.")
  .max(40, "Código muito longo.")
  .regex(/^[A-Za-z0-9._/-]+$/, "Código: use apenas letras, números, ponto, barra ou hífen.");

// Mapeamento ---------------------------------------------------------------------------------------
export const FONTES = ["SINAPI", "SICRO", "PROPRIA"] as const;
export type Fonte = (typeof FONTES)[number];

export const mapeamentoSchema = z.object({
  id: z.preprocess(vazioParaNull, z.string().uuid().nullable()),
  chave: z.string().trim().min(1).max(80).regex(/^[A-Z0-9_]+$/, "Chave de serviço inválida."),
  fonte: z.enum(FONTES, { message: "Escolha a fonte." }),
  padrao: z.preprocess(vazioParaNull, z.enum(PADROES).nullable()),
  codigo: codigoComposicao,
  fator: decimalTexto({ rotulo: "o fator de conversão", maiorQue: "0", maximo: "1000000", casas: 8 }),
  /** base usada para conferir o código (SINAPI/SICRO) */
  base: z.preprocess(vazioParaNull, z.string().uuid().nullable()),
}).superRefine((d, ctx) => {
  if (d.fonte !== "PROPRIA" && !d.base) {
    ctx.addIssue({ code: "custom", path: ["base"], message: `Escolha uma base ${d.fonte} importada para conferir o código.` });
  }
});
export type DadosMapeamento = z.output<typeof mapeamentoSchema>;

export const copiaPadraoSchema = z.object({
  origem: z.enum(PADROES),
  destino: z.enum(PADROES),
}).refine((d) => d.origem !== d.destino, { message: "Escolha padrões diferentes.", path: ["destino"] });

export const buscaSugestaoSchema = z.object({
  base: z.union([z.string().uuid(), z.literal("PROPRIA")], { message: "Escolha a base para buscar." }),
  termo: z.string().trim().min(2, "Digite ao menos 2 caracteres para buscar.").max(200),
});

// Índices ------------------------------------------------------------------------------------------
export const indiceSchema = z.object({
  chave: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/, "Índice inválido."),
  valor: decimalTexto({ rotulo: "o valor", minimo: "0", maximo: "1000000000", casas: 8 }),
});

// Composições próprias -----------------------------------------------------------------------------
export const composicaoPropriaSchema = z.object({
  id: z.preprocess(vazioParaNull, z.coerce.number().int().positive().nullable()),
  codigo: codigoComposicao,
  descricao: z.string().trim().min(3, "Descreva a composição (mínimo 3 caracteres).").max(400, "Descrição muito longa."),
  unidade: z.string().trim().min(1, "Informe a unidade.").max(12, "Unidade muito longa."),
  preco: decimalTexto({ rotulo: "o custo unitário", minimo: "0", maximo: "100000000", casas: 4 }),
});

// BDI (formulário em percentual; banco em fração) ---------------------------------------------------
export const COMPONENTES_BDI = ["ac", "s", "r", "g", "df", "l", "i"] as const;
export type ComponenteFormBdi = (typeof COMPONENTES_BDI)[number];
export const ROTULO_COMPONENTE_BDI: Readonly<Record<ComponenteFormBdi, string>> = {
  ac: "Administração central (AC)", s: "Seguro (S)", r: "Risco (R)", g: "Garantia (G)",
  df: "Despesas financeiras (DF)", l: "Lucro (L)", i: "Tributos (I)",
};
export const TIPOS_OBRA_BDI = ["edificacoes", "fornecimento_materiais"] as const;

const pct = (rotulo: string, menorQue = false) =>
  decimalTexto({ rotulo, minimo: "0", ...(menorQue ? { menorQue: "100" } : { maximo: "100" }), casas: 4 });

export const bdiSchema = z.object({
  id: z.preprocess(vazioParaNull, z.string().uuid().nullable()),
  nome: z.string().trim().min(2, "Dê um nome ao BDI.").max(80, "Nome muito longo."),
  tipo: z.enum(["servico", "material"], { message: "Escolha o tipo." }),
  tipo_obra: z.enum(TIPOS_OBRA_BDI, { message: "Escolha o tipo de obra." }),
  ac: pct("a administração central"),
  s: pct("o seguro"),
  r: pct("o risco"),
  g: pct("a garantia"),
  df: pct("as despesas financeiras"),
  l: pct("o lucro"),
  i: pct("os tributos", true),
});
/** Valores do formulário (todos texto; percentuais com vírgula ou ponto). */
export interface FormBdi {
  id: string;
  nome: string;
  tipo: "servico" | "material";
  tipo_obra: (typeof TIPOS_OBRA_BDI)[number];
  ac: string; s: string; r: string; g: string; df: string; l: string; i: string;
}
export type DadosBdi = z.output<typeof bdiSchema>;

export interface LinhaBdiBanco {
  nome: string; tipo: "servico" | "material"; tipo_obra: string;
  ac: string; s: string; r: string; g: string; df: string; l: string; i: string;
}

/** Converte o formulário validado (percentuais) para a linha do banco (frações). */
export function bdiParaBanco(d: DadosBdi): LinhaBdiBanco {
  const fr = (v: string) => percentualParaFracao(v);
  return {
    nome: d.nome, tipo: d.tipo, tipo_obra: d.tipo_obra,
    ac: fr(d.ac), s: fr(d.s), r: fr(d.r), g: fr(d.g), df: fr(d.df), l: fr(d.l), i: fr(d.i),
  };
}

/** BDI (fração) a partir dos percentuais do formulário; null se algum campo ainda é inválido. */
export function bdiDoFormulario(valores: Partial<Record<ComponenteFormBdi, string>>): string | null {
  const r = z.object(Object.fromEntries(COMPONENTES_BDI.map((c) => [c, bdiSchema.shape[c]]))).safeParse(valores);
  if (!r.success) return null;
  const f = r.data as Record<ComponenteFormBdi, string>;
  const p = Object.fromEntries(COMPONENTES_BDI.map((c) => [c, percentualParaFracao(f[c])])) as Record<ComponenteFormBdi, string>;
  return calcularBdi(p).toFixed();
}

// Padrões de acabamento ----------------------------------------------------------------------------
const revestimentoSchema = z.object({
  tipo: z.enum(TIPOS_REVESTIMENTO_PAREDE),
  altura: decimalTexto({ rotulo: "a altura do revestimento", minimo: "0", maximo: "10", casas: 2 }).transform(Number),
  ateOTeto: z.boolean(),
});

export const configPadraoSchema = z.object({
  rotulo: z.string().trim().min(1, "Informe o rótulo.").max(40),
  pisoSeco: z.enum(TIPOS_PISO),
  pisoMolhado: z.enum(TIPOS_PISO),
  revestimentoBanheiro: revestimentoSchema,
  revestimentoCozinha: revestimentoSchema,
  pintura: z.enum(TIPOS_PINTURA),
  forroSeco: z.enum(TIPOS_FORRO),
  forroMolhado: z.enum(TIPOS_FORRO),
  sanca: z.boolean(),
  janela: z.enum(MATERIAIS_JANELA),
  portaInterna: z.enum(MATERIAIS_PORTA),
  portaExterna: z.enum(MATERIAIS_PORTA),
  bancadas: z.string().trim().max(120, "Texto muito longo."),
  loucasMetais: z.string().trim().max(120, "Texto muito longo."),
  multiplicadorPontos: decimalTexto({ rotulo: "o multiplicador de pontos", maiorQue: "0", maximo: "10", casas: 2 }),
}) satisfies z.ZodType<ConfigPadrao, unknown>;

type LeitorForm = Pick<FormData, "get">;
const texto = (f: LeitorForm, nome: string): string => {
  const v = f.get(nome);
  return typeof v === "string" ? v : "";
};

/** Monta o objeto ConfigPadrao (ainda não validado) a partir dos campos do formulário. */
export function configPadraoDoFormulario(f: LeitorForm): Record<string, unknown> {
  const rev = (prefixo: string) => ({
    tipo: texto(f, `${prefixo}.tipo`),
    altura: texto(f, `${prefixo}.altura`) || "0",
    ateOTeto: f.get(`${prefixo}.ateOTeto`) === "on",
  });
  return {
    rotulo: texto(f, "rotulo"),
    pisoSeco: texto(f, "pisoSeco"), pisoMolhado: texto(f, "pisoMolhado"),
    revestimentoBanheiro: rev("revestimentoBanheiro"), revestimentoCozinha: rev("revestimentoCozinha"),
    pintura: texto(f, "pintura"), forroSeco: texto(f, "forroSeco"), forroMolhado: texto(f, "forroMolhado"),
    sanca: f.get("sanca") === "on",
    janela: texto(f, "janela"), portaInterna: texto(f, "portaInterna"), portaExterna: texto(f, "portaExterna"),
    bancadas: texto(f, "bancadas"), loucasMetais: texto(f, "loucasMetais"),
    multiplicadorPontos: texto(f, "multiplicadorPontos"),
  };
}

// Logo ---------------------------------------------------------------------------------------------
export const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024;
const EXTENSAO_LOGO = { "image/png": "png", "image/jpeg": "jpg" } as const;

export const arquivoLogoSchema = z.object({
  type: z.enum(["image/png", "image/jpeg"], { message: "Envie uma imagem PNG ou JPEG." }),
  size: z.number().int().positive("Arquivo vazio.").max(TAMANHO_MAXIMO_LOGO, "A imagem deve ter no máximo 2 MB."),
});

export function caminhoLogo(empresaId: string, tipo: keyof typeof EXTENSAO_LOGO): string {
  return `${empresaId}/logo.${EXTENSAO_LOGO[tipo]}`;
}

/** O caminho salvo precisa ser exatamente "<empresa_id>/logo.png|jpg". */
export const caminhoLogoValido = (empresaId: string, caminho: string): boolean =>
  caminho === `${empresaId}/logo.png` || caminho === `${empresaId}/logo.jpg`;

/** Primeira mensagem de erro de um resultado Zod. */
export function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}
