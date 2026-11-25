/**
 * Validação das tabelas paramétricas (tipo TabelasMotor) editadas como JSON em Configurações → Tabelas,
 * e a montagem do valor efetivo (padrão do motor ← semente global ← empresa), como em montarConfigMotor.
 */
import { z } from "zod";
import { CATALOGO_SERVICOS, ETAPAS, type Etapa } from "@/lib/engine/catalogo";
import { PADROES, TIPOS_AMBIENTE } from "@/lib/engine/entrada.schema";
import { TABELAS_PADRAO, type PontoHidraulico, type TabelasMotor } from "@/lib/engine/tabelas";
import { decimalTexto } from "./decimais";

export const CHAVES_TABELA = ["pontosHidraulicos", "regraTug", "fatorPrazo", "curvaEtapas", "reservatoriosComerciais"] as const;
export type ChaveTabela = (typeof CHAVES_TABELA)[number];

export const PONTOS_HIDRAULICOS = [
  "vaso", "lavatorio", "chuveiro", "ralo", "pia", "filtro", "maquina_louca", "tanque", "maquina_lavar",
] as const satisfies readonly PontoHidraulico[];
// garante que a lista acima cobre todos os pontos do motor
type _PontosCompletos = Exclude<PontoHidraulico, (typeof PONTOS_HIDRAULICOS)[number]> extends never ? true : never;
const _pontosCompletos: _PontosCompletos = true;
void _pontosCompletos;

const ETAPAS_IDS = ETAPAS.map((e) => e.id) as [Etapa, ...Etapa[]];

/** Tamanhos de reservatório que existem no catálogo (chave RESERVATORIO_<litros>L). */
export const TAMANHOS_RESERVATORIO: readonly number[] = CATALOGO_SERVICOS
  .map((s) => /^RESERVATORIO_(\d+)L$/.exec(s.chave)?.[1])
  .filter((v): v is string => v !== undefined)
  .map(Number)
  .sort((a, b) => a - b);

export const INFO_TABELA: Readonly<Record<ChaveTabela, { titulo: string; ajuda: string }>> = {
  pontosHidraulicos: {
    titulo: "Pontos hidráulicos por tipo de ambiente",
    ajuda: `Lista de pontos de cada tipo de ambiente. Pontos aceitos: ${PONTOS_HIDRAULICOS.join(", ")}.`,
  },
  regraTug: {
    titulo: "Regra de tomadas de uso geral (TUG)",
    ajuda: "\"seco\" = 1 TUG a cada N m de perímetro (índice tug_perimetro_seco); \"molhado\" = índice tug_perimetro_molhado; \"um\" = 1 ponto.",
  },
  fatorPrazo: {
    titulo: "Fator de prazo por padrão",
    ajuda: "Multiplica o prazo calculado da obra. Use números maiores que zero, como texto (ex.: \"1.15\").",
  },
  curvaEtapas: {
    titulo: "Curva das etapas no cronograma",
    ajuda: "Início e fim de cada etapa como fração do prazo: [início, fim], com 0 ≤ início ≤ fim ≤ 1.",
  },
  reservatoriosComerciais: {
    titulo: "Reservatórios comerciais (litros)",
    ajuda: `Tamanhos disponíveis para escolha do reservatório. Só são aceitos tamanhos que existem no catálogo: ${TAMANHOS_RESERVATORIO.join(", ")}.`,
  },
};

const fracao = z.number({ message: "Use números entre 0 e 1." }).min(0, "Valores devem ser ≥ 0.").max(1, "Valores devem ser ≤ 1.");

export const ESQUEMAS_TABELA = {
  pontosHidraulicos: z.record(z.enum(TIPOS_AMBIENTE), z.array(z.enum(PONTOS_HIDRAULICOS)).max(20)),
  regraTug: z.record(z.enum(TIPOS_AMBIENTE), z.enum(["seco", "molhado", "um"])),
  fatorPrazo: z.record(
    z.enum(PADROES),
    decimalTexto({ rotulo: "o fator de prazo", maiorQue: "0", maximo: "10", casas: 4 }),
  ),
  curvaEtapas: z.record(
    z.enum(ETAPAS_IDS),
    z.tuple([fracao, fracao]).refine(([inicio, fim]) => inicio <= fim, "O início da etapa deve ser menor ou igual ao fim."),
  ),
  reservatoriosComerciais: z.array(
    z.number().int("Use litros inteiros.").refine((v) => TAMANHOS_RESERVATORIO.includes(v), {
      message: `Tamanho de reservatório fora do catálogo (aceitos: ${TAMANHOS_RESERVATORIO.join(", ")}).`,
    }),
  ).min(1, "Informe ao menos um tamanho.")
    .refine((l) => new Set(l).size === l.length, "Há tamanhos repetidos.")
    .transform((l) => [...l].sort((a, b) => a - b)),
} satisfies Record<ChaveTabela, z.ZodType>;

export type ResultadoTabela =
  | { ok: true; valor: TabelasMotor[ChaveTabela] }
  | { ok: false; erro: string };

const caminho = (p: readonly PropertyKey[]): string => (p.length ? `${p.map(String).join(".")}: ` : "");

/** Interpreta e valida o JSON de uma tabela. */
export function validarTabela(chave: ChaveTabela, textoJson: string): ResultadoTabela {
  let bruto: unknown;
  try {
    bruto = JSON.parse(textoJson);
  } catch {
    return { ok: false, erro: "JSON inválido: confira vírgulas, aspas e colchetes." };
  }
  const r = ESQUEMAS_TABELA[chave].safeParse(bruto);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, erro: i ? `${caminho(i.path)}${i.message}` : "Tabela inválida." };
  }
  return { ok: true, valor: r.data as TabelasMotor[ChaveTabela] };
}

export const ehChaveTabela = (v: string): v is ChaveTabela => (CHAVES_TABELA as readonly string[]).includes(v);

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export interface LinhaTabelaBanco { empresa_id: string | null; chave: string; config: unknown }

/** Valor efetivo de cada tabela: padrão do motor, sobrescrito pela semente global e depois pela empresa. */
export function tabelasEfetivas(linhas: readonly LinhaTabelaBanco[]): Record<ChaveTabela, unknown> {
  const saida: Record<string, unknown> = { ...TABELAS_PADRAO };
  const ordenadas = [...linhas].sort((a, b) => Number(a.empresa_id !== null) - Number(b.empresa_id !== null));
  for (const l of ordenadas) {
    if (!ehChaveTabela(l.chave)) continue;
    const atual = saida[l.chave];
    saida[l.chave] = ehObjeto(atual) && ehObjeto(l.config) ? { ...atual, ...l.config } : l.config;
  }
  return saida as Record<ChaveTabela, unknown>;
}

/** JSON legível para o textarea: uma entrada por linha nos objetos. */
export function formatarTabela(valor: unknown): string {
  if (ehObjeto(valor)) {
    const linhas = Object.entries(valor).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return `{\n${linhas.join(",\n")}\n}`;
  }
  return JSON.stringify(valor);
}
