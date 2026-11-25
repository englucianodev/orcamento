/** Rótulos e navegação das telas de Configurações. */
import type { Padrao } from "@/lib/engine/entrada.schema";

export interface SecaoConfiguracao {
  href: string;
  titulo: string;
  descricao: string;
}

export const SECOES_CONFIGURACAO: readonly SecaoConfiguracao[] = [
  { href: "/configuracoes/mapeamento", titulo: "Mapeamento", descricao: "Liga cada serviço do catálogo a uma composição SINAPI, SICRO ou própria." },
  { href: "/configuracoes/indices", titulo: "Índices", descricao: "Fatores paramétricos usados no cálculo dos quantitativos." },
  { href: "/configuracoes/padroes", titulo: "Padrões", descricao: "Acabamentos sugeridos para os padrões baixo, normal, alto e luxo." },
  { href: "/configuracoes/tabelas", titulo: "Tabelas", descricao: "Pontos hidráulicos, regra de tomadas, prazo, curva das etapas e reservatórios." },
  { href: "/configuracoes/bdi", titulo: "BDI", descricao: "Composições de BDI (fórmula do TCU) para serviços e materiais." },
  { href: "/configuracoes/composicoes", titulo: "Composições próprias", descricao: "Serviços da empresa com custo unitário informado." },
  { href: "/configuracoes/logo", titulo: "Logo", descricao: "Logotipo exibido nos relatórios." },
];

export const ROTULO_PADRAO: Readonly<Record<Padrao, string>> = {
  baixo: "Baixo", normal: "Normal", alto: "Alto", luxo: "Luxo",
};

export const ROTULO_FONTE: Readonly<Record<"SINAPI" | "SICRO" | "PROPRIA", string>> = {
  SINAPI: "SINAPI", SICRO: "SICRO", PROPRIA: "Própria",
};

const ESPECIAIS: Readonly<Record<string, string>> = {
  ceramica_pei4: "Cerâmica PEI-4",
  ceramica: "Cerâmica",
  porcelanato_60x60: "Porcelanato 60×60",
  porcelanato_90x90: "Porcelanato 90×90",
  porcelanato_grande_formato: "Porcelanato grande formato",
  marmore: "Mármore",
  laminado: "Laminado",
  vinilico: "Vinílico",
  latex_pva: "Látex PVA",
  acrilica_massa_pva: "Acrílica + massa PVA",
  acrilica_massa_acrilica: "Acrílica + massa acrílica",
  acrilica_premium: "Acrílica premium",
  sem_forro: "Sem forro",
  gesso_placa: "Gesso em placa",
  gesso_drywall: "Gesso drywall",
  madeira_semioca: "Madeira semioca",
  madeira_kit_pronta: "Kit porta pronta",
  madeira_macica: "Madeira maciça",
  aluminio: "Alumínio",
  aluminio_linha_25: "Alumínio linha 25",
  aluminio_linha_gold: "Alumínio linha Gold",
  sob_medida_vidro_duplo: "Sob medida, vidro duplo",
  vidro_temperado: "Vidro temperado",
  edificacoes: "Edificações",
  fornecimento_materiais: "Fornecimento de materiais",
  servico: "Serviços",
  material: "Materiais",
};

/** Rótulo legível para valores de enum ("gesso_drywall" → "Gesso drywall"). */
export function rotuloOpcao(valor: string): string {
  const especial = ESPECIAIS[valor];
  if (especial) return especial;
  const t = valor.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
