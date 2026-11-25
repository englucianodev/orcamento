/**
 * Descrição da obra (entrada do motor), seção 6 do prompt. Versão 1.
 * Todas as medidas em metros. Os mesmos schemas validam no navegador (react-hook-form) e no servidor.
 */
import { z } from "zod";

export const VERSAO_ENTRADA = 1 as const;

export const PADROES = ["baixo", "normal", "alto", "luxo"] as const;
export type Padrao = (typeof PADROES)[number];

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI",
  "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export const TIPOS_AMBIENTE = [
  "quarto", "suite", "closet", "sala_estar", "sala_jantar", "cozinha", "copa", "banheiro", "lavabo",
  "area_servico", "despensa", "escritorio", "circulacao", "escada", "garagem", "varanda", "area_gourmet",
  "home_theater", "adega", "deposito", "outro",
] as const;
export type TipoAmbiente = (typeof TIPOS_AMBIENTE)[number];

export const TIPOS_PISO = [
  "ceramica_pei4", "porcelanato_60x60", "porcelanato_90x90", "porcelanato_grande_formato", "marmore",
  "laminado", "vinilico", "cimentado", "deck_madeira", "nenhum",
] as const;
export const TIPOS_REVESTIMENTO_PAREDE = ["nenhum", "ceramica", "porcelanato"] as const;
export const TIPOS_FORRO = ["sem_forro", "pvc", "gesso_placa", "gesso_drywall", "madeira"] as const;
export type TipoForro = (typeof TIPOS_FORRO)[number];
export const TIPOS_PINTURA = [
  "latex_pva", "acrilica_massa_pva", "acrilica_massa_acrilica", "acrilica_premium", "nenhuma",
] as const;
export const MATERIAIS_PORTA = [
  "madeira_semioca", "madeira_kit_pronta", "madeira_macica", "aluminio", "vidro_temperado", "pvc",
] as const;
export const MATERIAIS_JANELA = [
  "aluminio", "aluminio_linha_25", "aluminio_linha_gold", "pvc", "madeira", "vidro_temperado", "sob_medida_vidro_duplo",
] as const;

const metros = (min: number, max: number) => z.number().min(min).max(max);
const id = z.string().min(1).max(64);

export const vaoSchema = z.object({
  id,
  tipo: z.enum(["porta", "janela"]),
  quantidade: z.number().int().min(1).max(50),
  largura: metros(0.3, 10),
  altura: metros(0.3, 6),
  material: z.enum([...MATERIAIS_PORTA, ...MATERIAIS_JANELA]),
  /** porta para o exterior: gera soleira e entra no desconto do revestimento externo */
  externa: z.boolean().default(false),
});
export type Vao = z.infer<typeof vaoSchema>;

export const ambienteSchema = z
  .object({
    id,
    tipo: z.enum(TIPOS_AMBIENTE),
    nome: z.string().trim().min(1).max(80),
    pavimento: z.number().int().min(1).max(10),
    largura: metros(0.6, 50).nullable().default(null),
    comprimento: metros(0.6, 50).nullable().default(null),
    /** formato irregular: área informada à mão (e perímetro, se conhecido) */
    areaManual: metros(0.3, 2500).nullable().default(null),
    perimetroManual: metros(1, 400).nullable().default(null),
    peDireito: metros(2.2, 12).default(2.8),
    peDireitoDuplo: z.boolean().default(false),
    alturaLivre: metros(2.2, 12).nullable().default(null),
    paredes: z.object({
      modo: z.enum(["todas", "parcial", "nenhuma"]).default("todas"),
      percentual: z.number().min(0).max(100).default(100),
    }).default({ modo: "todas", percentual: 100 }),
    externo: z.boolean().default(false),
    coberto: z.boolean().default(true),
    /** null = automático pelo tipo */
    areaMolhada: z.boolean().nullable().default(null),
    vaos: z.array(vaoSchema).max(40).default([]),
    piso: z.enum(TIPOS_PISO),
    revestimentoParede: z.object({
      tipo: z.enum(TIPOS_REVESTIMENTO_PAREDE),
      altura: metros(0, 12).default(0),
      ateOTeto: z.boolean().default(false),
    }),
    forro: z.enum(TIPOS_FORRO),
    pintura: z.enum(TIPOS_PINTURA),
  })
  .refine((a) => (a.largura !== null && a.comprimento !== null) || a.areaManual !== null, {
    message: "Informe largura e comprimento, ou a área manual.",
    path: ["largura"],
  });
export type Ambiente = z.infer<typeof ambienteSchema>;

export const dadosGeraisSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  cliente: z.string().trim().max(120).default(""),
  uf: z.enum(UFS),
  municipio: z.string().trim().max(80).default(""),
  /** data-base AAAA-MM-01 de uma base importada */
  mesBase: z.string().regex(/^\d{4}-\d{2}-01$/).nullable().default(null),
  desonerado: z.boolean().default(false),
  padrao: z.enum(PADROES),
  pavimentos: z.number().int().min(1).max(10).default(1),
});

export const terrenoSchema = z.object({
  largura: metros(3, 500),
  profundidade: metros(3, 500),
  topografia: z.enum(["plano", "aclive", "declive"]).default("plano"),
  desnivel: metros(0, 30).default(0),
  solo: z.enum(["argiloso", "arenoso", "siltoso", "rochoso", "misto"]).default("misto"),
  vegetacao: z.enum(["leve", "media", "densa"]).default("leve"),
  muro: z.object({
    frente: z.boolean().default(false),
    fundos: z.boolean().default(false),
    esquerda: z.boolean().default(false),
    direita: z.boolean().default(false),
    altura: metros(0, 6).default(2.2),
  }).default({ frente: false, fundos: false, esquerda: false, direita: false, altura: 2.2 }),
  portao: z.object({
    existe: z.boolean().default(false),
    largura: metros(0, 15).default(3),
    altura: metros(0, 5).default(2.2),
    tipo: z.enum(["basculante", "deslizante", "pivotante", "abrir"]).default("deslizante"),
    automatizado: z.boolean().default(false),
  }).default({ existe: false, largura: 3, altura: 2.2, tipo: "deslizante", automatizado: false }),
  calcadaPerimetral: z.boolean().default(true),
  passeioPublico: z.object({ existe: z.boolean().default(false), largura: metros(0, 10).default(1.5) })
    .default({ existe: false, largura: 1.5 }),
  /** distância de transporte do bota-fora (km); null = índice padrão */
  dmtBotaForaKm: metros(0, 200).nullable().default(null),
});

export const construcaoSchema = z.object({
  projecaoLargura: metros(2, 200).nullable().default(null),
  projecaoComprimento: metros(2, 200).nullable().default(null),
  estrutura: z.enum(["concreto_armado", "alvenaria_estrutural", "metalica"]).default("concreto_armado"),
  fundacao: z.enum(["sapata", "radier", "estaca_broca", "helice_continua", "automatico"]).default("automatico"),
  laje: z.enum(["macica", "trelicada", "sem_laje"]).default("trelicada"),
  vedacao: z.enum(["bloco_ceramico", "bloco_concreto", "drywall"]).default("bloco_ceramico"),
  espessuraParede: metros(0.07, 0.4).default(0.14),
});

export const coberturaSchema = z.object({
  telha: z.enum(["ceramica", "concreto", "fibrocimento", "metalica", "termoacustica", "shingle", "laje_impermeabilizada"]),
  inclinacao: z.number().min(0).max(200).default(30),
  aguas: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(2),
  beiral: metros(0, 3).default(0.6),
  estrutura: z.enum(["madeira", "metalica"]).default("madeira"),
  platibanda: z.object({ existe: z.boolean().default(false), altura: metros(0, 3).default(1) })
    .default({ existe: false, altura: 1 }),
  calhas: z.boolean().default(true),
  rufos: z.boolean().default(true),
});

export const instalacoesSchema = z.object({
  aguaQuente: z.enum(["nenhuma", "eletrica", "gas", "solar"]).default("eletrica"),
  esgoto: z.enum(["rede_publica", "fossa_sumidouro"]).default("rede_publica"),
  /** null = 2 por quarto/suíte */
  moradores: z.number().int().min(1).max(100).nullable().default(null),
  /** null = automático */
  reservatorioLitros: z.number().int().min(0).max(100000).nullable().default(null),
  cisternaLitros: z.number().int().min(0).max(100000).default(0),
  solarKwp: z.number().min(0).max(500).default(0),
  pontosAr: z.number().int().min(0).max(50).default(0),
  spda: z.boolean().default(false),
  automacao: z.boolean().default(false),
  redeLogica: z.boolean().default(false),
  cftvCameras: z.number().int().min(0).max(64).default(0),
});

export const piscinaSchema = z.object({
  existe: z.boolean().default(false),
  comprimento: metros(1, 50).default(8),
  largura: metros(1, 25).default(4),
  profundidadeMin: metros(0.3, 5).default(1.2),
  profundidadeMax: metros(0.3, 5).default(1.6),
  tipo: z.enum(["concreto_armado", "alvenaria", "vinil", "fibra"]).default("concreto_armado"),
  aquecimento: z.enum(["nenhum", "solar", "bomba_calor", "gas"]).default("nenhum"),
  iluminacao: z.boolean().default(true),
  casaMaquinas: z.boolean().default(true),
  borda: z.boolean().default(true),
}).refine((p) => p.profundidadeMax >= p.profundidadeMin, {
  message: "A profundidade máxima deve ser maior ou igual à mínima.", path: ["profundidadeMax"],
});

export const gourmetSchema = z.object({
  churrasqueira: z.enum(["nenhuma", "alvenaria", "pre_moldada", "gas"]).default("nenhuma"),
  bancadaMetros: metros(0, 30).default(0),
  pia: z.boolean().default(false),
  fornoPizza: z.boolean().default(false),
  coifa: z.boolean().default(false),
});

export const lazerSchema = z.object({
  piscina: piscinaSchema.default(piscinaSchema.parse({})),
  gourmet: gourmetSchema.default(gourmetSchema.parse({})),
  deckM2: metros(0, 2000).default(0),
  pergoladoM2: metros(0, 2000).default(0),
  paisagismoM2: metros(0, 50000).default(0),
  sauna: z.boolean().default(false),
  quadraM2: metros(0, 5000).default(0),
  playground: z.boolean().default(false),
  canil: z.boolean().default(false),
});

export const entradaSchema = z.object({
  versao: z.literal(VERSAO_ENTRADA),
  dadosGerais: dadosGeraisSchema,
  terreno: terrenoSchema,
  construcao: construcaoSchema.default(construcaoSchema.parse({})),
  ambientes: z.array(ambienteSchema).min(1, "Adicione pelo menos um ambiente.").max(200),
  cobertura: coberturaSchema,
  instalacoes: instalacoesSchema.default(instalacoesSchema.parse({})),
  lazer: lazerSchema.default(lazerSchema.parse({})),
}).superRefine((e, ctx) => {
  e.ambientes.forEach((a, i) => {
    if (a.pavimento > e.dadosGerais.pavimentos) {
      ctx.addIssue({ code: "custom", path: ["ambientes", i, "pavimento"], message: `Pavimento ${a.pavimento} além do nº de pavimentos.` });
    }
  });
  const ids = new Set<string>();
  e.ambientes.forEach((a, i) => {
    if (ids.has(a.id)) ctx.addIssue({ code: "custom", path: ["ambientes", i, "id"], message: "Ambiente repetido." });
    ids.add(a.id);
  });
});

export type Entrada = z.infer<typeof entradaSchema>;
export type EntradaBruta = z.input<typeof entradaSchema>;

/** Rascunho do assistente: tudo opcional, validado por etapa. */
export const rascunhoSchema = z.object({ versao: z.literal(VERSAO_ENTRADA) }).passthrough();
