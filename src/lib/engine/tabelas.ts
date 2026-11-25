/**
 * Tabelas paramétricas do motor (pontos por tipo de ambiente, regra de TUG, prazo e curva das etapas).
 * Semente de `tabelas_parametricas`; editáveis pela empresa. Valores iniciais da seção 7 do prompt.
 */
import type { Etapa } from "./catalogo";
import type { Padrao, TipoAmbiente } from "./entrada.schema";

export const AREAS_MOLHADAS: ReadonlySet<TipoAmbiente> = new Set<TipoAmbiente>([
  "banheiro", "lavabo", "cozinha", "area_servico", "area_gourmet",
]);

export type PontoHidraulico =
  | "vaso" | "lavatorio" | "chuveiro" | "ralo" | "pia" | "filtro" | "maquina_louca" | "tanque" | "maquina_lavar";

/** Regra de TUG: "seco" = ceil(P / 5); "molhado" = ceil(P / 3,5); "um" = 1 ponto. */
export type RegraTug = "seco" | "molhado" | "um";

export interface TabelasMotor {
  pontosHidraulicos: Readonly<Record<TipoAmbiente, readonly PontoHidraulico[]>>;
  regraTug: Readonly<Record<TipoAmbiente, RegraTug>>;
  /** fator do prazo por padrão */
  fatorPrazo: Readonly<Record<Padrao, string>>;
  /** início e fim da etapa como fração do prazo (curva típica de obra residencial) */
  curvaEtapas: Readonly<Record<Etapa, readonly [number, number]>>;
  reservatoriosComerciais: readonly number[];
}

const nenhum: readonly PontoHidraulico[] = [];

export const TABELAS_PADRAO: TabelasMotor = {
  pontosHidraulicos: {
    banheiro: ["vaso", "lavatorio", "chuveiro", "ralo"],
    lavabo: ["vaso", "lavatorio"],
    cozinha: ["pia", "filtro", "maquina_louca"],
    area_servico: ["tanque", "maquina_lavar"],
    area_gourmet: ["pia"],
    quarto: nenhum, suite: nenhum, closet: nenhum, sala_estar: nenhum, sala_jantar: nenhum, copa: nenhum,
    despensa: nenhum, escritorio: nenhum, circulacao: nenhum, escada: nenhum, garagem: nenhum, varanda: nenhum,
    home_theater: nenhum, adega: nenhum, deposito: nenhum, outro: nenhum,
  },
  regraTug: {
    quarto: "seco", suite: "seco", sala_estar: "seco", sala_jantar: "seco", escritorio: "seco",
    home_theater: "seco", garagem: "seco", varanda: "seco", outro: "seco",
    cozinha: "molhado", copa: "molhado", area_servico: "molhado", area_gourmet: "molhado",
    banheiro: "um", lavabo: "um", closet: "um", despensa: "um", circulacao: "um", escada: "um",
    adega: "um", deposito: "um",
  },
  fatorPrazo: { baixo: "0.9", normal: "1", alto: "1.15", luxo: "1.3" },
  curvaEtapas: {
    preliminares: [0, 0.08],
    terraplenagem: [0, 0.1],
    fundacao: [0.05, 0.2],
    estrutura: [0.12, 0.5],
    alvenaria: [0.2, 0.55],
    cobertura: [0.45, 0.65],
    revestimentos: [0.5, 0.85],
    forro: [0.65, 0.85],
    impermeabilizacao: [0.15, 0.7],
    esquadrias: [0.6, 0.92],
    eletrica: [0.3, 0.9],
    hidrossanitaria: [0.2, 0.85],
    loucas_metais: [0.85, 1],
    pintura: [0.75, 1],
    piscina: [0.3, 0.85],
    area_gourmet: [0.7, 0.95],
    areas_externas: [0.75, 1],
    sistemas_especiais: [0.75, 1],
    administracao: [0, 1],
  },
  reservatoriosComerciais: [500, 1000, 1500, 2000, 3000, 5000, 10000],
};
