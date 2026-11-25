/**
 * Matriz de padrão de acabamento (seção 6.3) e sugestões de ambiente do assistente.
 * Semente de `padroes_acabamento.config`; a empresa edita em Configurações → Padrões.
 */
import type {
  Ambiente, Padrao, TipoAmbiente, TipoForro, TIPOS_PINTURA, TIPOS_PISO, TIPOS_REVESTIMENTO_PAREDE, Vao,
} from "./entrada.schema";
import { AREAS_MOLHADAS } from "./tabelas";

type TipoPiso = (typeof TIPOS_PISO)[number];
type TipoPintura = (typeof TIPOS_PINTURA)[number];
type TipoRevestimento = (typeof TIPOS_REVESTIMENTO_PAREDE)[number];

export interface RevestimentoPadrao {
  tipo: TipoRevestimento;
  altura: number;
  ateOTeto: boolean;
}

export interface ConfigPadrao {
  rotulo: string;
  pisoSeco: TipoPiso;
  pisoMolhado: TipoPiso;
  revestimentoBanheiro: RevestimentoPadrao;
  revestimentoCozinha: RevestimentoPadrao;
  pintura: TipoPintura;
  forroSeco: TipoForro;
  forroMolhado: TipoForro;
  sanca: boolean;
  janela: Vao["material"];
  portaInterna: Vao["material"];
  portaExterna: Vao["material"];
  /** textos exibidos; o serviço concreto vem do mapeamento por padrão */
  bancadas: string;
  loucasMetais: string;
  multiplicadorPontos: string;
}

export const PADROES_ACABAMENTO: Readonly<Record<Padrao, ConfigPadrao>> = {
  baixo: {
    rotulo: "Baixo", pisoSeco: "ceramica_pei4", pisoMolhado: "ceramica_pei4",
    revestimentoBanheiro: { tipo: "ceramica", altura: 1.5, ateOTeto: false },
    revestimentoCozinha: { tipo: "ceramica", altura: 1.5, ateOTeto: false },
    pintura: "latex_pva", forroSeco: "sem_forro", forroMolhado: "pvc", sanca: false,
    janela: "aluminio", portaInterna: "madeira_semioca", portaExterna: "madeira_macica",
    bancadas: "Granito comum", loucasMetais: "Linha econômica", multiplicadorPontos: "1.0",
  },
  normal: {
    rotulo: "Normal", pisoSeco: "porcelanato_60x60", pisoMolhado: "porcelanato_60x60",
    revestimentoBanheiro: { tipo: "ceramica", altura: 0, ateOTeto: true },
    revestimentoCozinha: { tipo: "ceramica", altura: 1.5, ateOTeto: false },
    pintura: "acrilica_massa_pva", forroSeco: "gesso_placa", forroMolhado: "gesso_placa", sanca: false,
    janela: "aluminio_linha_25", portaInterna: "madeira_kit_pronta", portaExterna: "madeira_macica",
    bancadas: "Granito", loucasMetais: "Linha intermediária", multiplicadorPontos: "1.2",
  },
  alto: {
    rotulo: "Alto", pisoSeco: "porcelanato_90x90", pisoMolhado: "porcelanato_60x60",
    revestimentoBanheiro: { tipo: "porcelanato", altura: 0, ateOTeto: true },
    revestimentoCozinha: { tipo: "porcelanato", altura: 0, ateOTeto: true },
    pintura: "acrilica_massa_acrilica", forroSeco: "gesso_drywall", forroMolhado: "gesso_drywall", sanca: false,
    janela: "aluminio_linha_gold", portaInterna: "madeira_macica", portaExterna: "madeira_macica",
    bancadas: "Quartzo", loucasMetais: "Linha alta", multiplicadorPontos: "1.5",
  },
  luxo: {
    rotulo: "Luxo", pisoSeco: "porcelanato_grande_formato", pisoMolhado: "porcelanato_90x90",
    revestimentoBanheiro: { tipo: "porcelanato", altura: 0, ateOTeto: true },
    revestimentoCozinha: { tipo: "porcelanato", altura: 0, ateOTeto: true },
    pintura: "acrilica_premium", forroSeco: "gesso_drywall", forroMolhado: "gesso_drywall", sanca: true,
    janela: "sob_medida_vidro_duplo", portaInterna: "madeira_macica", portaExterna: "madeira_macica",
    bancadas: "Mármore / quartzo especial", loucasMetais: "Linha premium", multiplicadorPontos: "2.0",
  },
};

interface Sugestao {
  nome: string;
  largura: number;
  comprimento: number;
  paredes?: Ambiente["paredes"];
  externo?: boolean;
  vaos: Array<Pick<Vao, "tipo" | "largura" | "altura"> & { externa?: boolean }>;
}

const P = (largura: number, externa = false) => ({ tipo: "porta" as const, largura, altura: 2.1, externa });
const J = (largura: number, altura: number) => ({ tipo: "janela" as const, largura, altura });

/** Medidas sugeridas pelos atalhos ("3 quartos, 1 suíte…"); o usuário ajusta. */
export const SUGESTOES_AMBIENTE: Readonly<Record<TipoAmbiente, Sugestao>> = {
  quarto: { nome: "Quarto", largura: 3, comprimento: 3.5, vaos: [P(0.8), J(1.2, 1)] },
  suite: { nome: "Suíte", largura: 3.5, comprimento: 4, vaos: [P(0.8), J(1.5, 1.2)] },
  closet: { nome: "Closet", largura: 1.5, comprimento: 2, vaos: [P(0.7)] },
  sala_estar: { nome: "Sala de estar", largura: 4, comprimento: 5, vaos: [P(0.9, true), J(2, 1.2)] },
  sala_jantar: { nome: "Sala de jantar", largura: 3.5, comprimento: 4, vaos: [J(1.5, 1.2)] },
  cozinha: { nome: "Cozinha", largura: 3, comprimento: 4, vaos: [P(0.8), J(1.2, 1)] },
  copa: { nome: "Copa", largura: 2.5, comprimento: 3, vaos: [J(1.2, 1)] },
  banheiro: { nome: "Banheiro", largura: 1.5, comprimento: 2.5, vaos: [P(0.7), J(0.6, 0.6)] },
  lavabo: { nome: "Lavabo", largura: 1.2, comprimento: 1.8, vaos: [P(0.7), J(0.6, 0.6)] },
  area_servico: { nome: "Área de serviço", largura: 2, comprimento: 2.5, vaos: [P(0.8, true), J(1, 1)] },
  despensa: { nome: "Despensa", largura: 1.5, comprimento: 2, vaos: [P(0.7)] },
  escritorio: { nome: "Escritório", largura: 3, comprimento: 3, vaos: [P(0.8), J(1.2, 1)] },
  circulacao: { nome: "Circulação", largura: 1.2, comprimento: 5, vaos: [] },
  escada: { nome: "Escada", largura: 1.2, comprimento: 4, vaos: [] },
  garagem: { nome: "Garagem", largura: 5.5, comprimento: 6, paredes: { modo: "parcial", percentual: 75 }, vaos: [P(0.8, true)] },
  varanda: { nome: "Varanda", largura: 2, comprimento: 4, paredes: { modo: "nenhuma", percentual: 0 }, externo: true, vaos: [] },
  area_gourmet: { nome: "Área gourmet", largura: 4, comprimento: 5, paredes: { modo: "parcial", percentual: 50 }, externo: true, vaos: [] },
  home_theater: { nome: "Home theater", largura: 4, comprimento: 5, vaos: [P(0.8)] },
  adega: { nome: "Adega", largura: 2, comprimento: 2, vaos: [P(0.8)] },
  deposito: { nome: "Depósito", largura: 2, comprimento: 2, vaos: [P(0.8)] },
  outro: { nome: "Ambiente", largura: 3, comprimento: 3, vaos: [P(0.8)] },
};

function revestimentoSugerido(tipo: TipoAmbiente, cfg: ConfigPadrao): RevestimentoPadrao {
  if (tipo === "banheiro" || tipo === "lavabo") return cfg.revestimentoBanheiro;
  if (tipo === "cozinha" || tipo === "area_servico" || tipo === "area_gourmet") return cfg.revestimentoCozinha;
  return { tipo: "nenhum", altura: 0, ateOTeto: false };
}

/** Cria um ambiente completo com medidas e acabamentos sugeridos pelo tipo e padrão. */
export function sugerirAmbiente(
  tipo: TipoAmbiente, padrao: Padrao, id: string, numero = 1, pavimento = 1,
  cfg: ConfigPadrao = PADROES_ACABAMENTO[padrao],
): Ambiente {
  const s = SUGESTOES_AMBIENTE[tipo];
  const molhada = AREAS_MOLHADAS.has(tipo);
  const externo = s.externo ?? false;
  return {
    id, tipo, nome: numero > 1 || tipo === "quarto" ? `${s.nome} ${numero}` : s.nome, pavimento,
    largura: s.largura, comprimento: s.comprimento, areaManual: null, perimetroManual: null,
    peDireito: 2.8, peDireitoDuplo: false, alturaLivre: null,
    paredes: s.paredes ?? { modo: "todas", percentual: 100 },
    externo, coberto: true, areaMolhada: null,
    vaos: s.vaos.map((v, i) => ({
      id: `${id}-v${i + 1}`, tipo: v.tipo, quantidade: 1, largura: v.largura, altura: v.altura,
      externa: v.externa ?? false,
      material: v.tipo === "janela" ? cfg.janela : v.externa ? cfg.portaExterna : cfg.portaInterna,
    })),
    piso: molhada ? cfg.pisoMolhado : cfg.pisoSeco,
    revestimentoParede: revestimentoSugerido(tipo, cfg),
    forro: externo && tipo === "varanda" ? "sem_forro" : molhada ? cfg.forroMolhado : cfg.forroSeco,
    pintura: cfg.pintura,
  };
}

const PADROES_ATALHO: ReadonlyArray<[RegExp, TipoAmbiente]> = [
  [/su[ií]tes?/, "suite"], [/quartos?|dormit[oó]rios?/, "quarto"], [/banheiros?|wc/, "banheiro"],
  [/lavabos?/, "lavabo"], [/salas? de jantar/, "sala_jantar"], [/salas?( de estar)?/, "sala_estar"],
  [/cozinhas?/, "cozinha"], [/copas?/, "copa"], [/(áreas?|areas?) de servi[cç]o|lavanderias?/, "area_servico"],
  [/(áreas?|areas?) gourmet/, "area_gourmet"], [/garage(m|ns)/, "garagem"], [/varandas?/, "varanda"],
  [/escrit[oó]rios?/, "escritorio"], [/closets?/, "closet"], [/despensas?/, "despensa"],
  [/circula[cç](ão|ao|ões|oes)|corredor(es)?/, "circulacao"], [/home theater/, "home_theater"],
];

/** Interpreta "3 quartos, 1 suíte, 2 banheiros" → [{tipo, quantidade}]. */
export function interpretarAtalho(texto: string): Array<{ tipo: TipoAmbiente; quantidade: number }> {
  const saida: Array<{ tipo: TipoAmbiente; quantidade: number }> = [];
  for (const parte of texto.toLowerCase().split(/[,;]| e /)) {
    const t = parte.trim();
    if (!t) continue;
    const qtd = Number(/^(\d+)/.exec(t)?.[1] ?? "1");
    const achado = PADROES_ATALHO.find(([re]) => re.test(t));
    if (achado && qtd > 0 && qtd <= 30) saida.push({ tipo: achado[1], quantidade: qtd });
  }
  return saida;
}
