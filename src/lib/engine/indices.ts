/**
 * Índices paramétricos do motor ([cfg] da seção 7 do prompt).
 * Estes valores são a SEMENTE da tabela `indices_parametricos` (tools/gerar-seed.ts) e o padrão quando o
 * banco não traz um valor. A empresa edita em Configurações → Índices. Não há orçamentos reais em
 * `referencias/` para calibrar (docs/ANALISE_REFERENCIAS.md §4), então a origem é o próprio prompt.
 */
import { D, type Dec, type ValorDecimal } from "./decimal";

interface DefinicaoIndice {
  chave: string;
  valor: string;
  unidade: string;
  descricao: string;
  origem: "prompt" | "padrão inicial";
}

const def = <K extends string>(chave: K, valor: string, unidade: string, descricao: string, origem: DefinicaoIndice["origem"] = "prompt") =>
  ({ chave, valor, unidade, descricao, origem }) as const;

export const INDICES_PADRAO = [
  // geometria
  def("desconto_vaos_area_minima", "2.00", "m²", "Descontar da parede só os vãos com área maior que este valor (0 = descontar todos)"),
  def("k_paredes", "0.12", "fração", "Acréscimo de área de paredes sobre a soma das áreas úteis (projeção estimada)"),
  def("proporcao_projecao", "1.5", "razão", "Proporção comprimento/largura do retângulo da projeção estimada"),
  def("janela_peitoril", "1.10", "m", "Altura do peitoril das janelas (desconto na faixa de revestimento)", "padrão inicial"),
  // preliminares
  def("tapume_altura", "2.20", "m", "Altura do tapume na frente do terreno"),
  def("barracao_pct", "0.01", "fração", "Área do barracão sobre a área construída"),
  def("barracao_minimo", "6", "m²", "Área mínima do barracão"),
  def("placa_obra_area", "6", "m²", "Área da placa de obra", "padrão inicial"),
  // terraplenagem
  def("empolamento", "1.25", "fator", "Empolamento do material escavado (bota-fora)"),
  def("terraplenagem_limite_sicro", "500", "m³", "Acima deste volume a terraplenagem usa composições SICRO"),
  def("dmt_padrao_km", "10", "km", "DMT do bota-fora quando não informada", "padrão inicial"),
  // fundação
  def("baldrame_largura", "0.15", "m", "Largura da viga baldrame"),
  def("baldrame_altura", "0.30", "m", "Altura da viga baldrame"),
  def("baldrame_aco", "80", "kg/m³", "Taxa de aço da viga baldrame"),
  def("baldrame_folga_escavacao", "0.30", "m", "Sobrelargura total da vala do baldrame", "padrão inicial"),
  def("pilar_espacamento", "3.5", "m", "Espaçamento médio entre pilares (nº de pilares)"),
  def("sapata_volume", "0.40", "m³", "Volume de concreto por sapata", "padrão inicial"),
  def("sapata_aco", "60", "kg/m³", "Taxa de aço das sapatas", "padrão inicial"),
  def("sapata_escavacao_fator", "2", "m³/m³", "Escavação por m³ de concreto de sapata", "padrão inicial"),
  def("estaca_broca_comprimento", "3", "m", "Comprimento por estaca broca", "padrão inicial"),
  def("estaca_helice_comprimento", "8", "m", "Comprimento por estaca hélice contínua", "padrão inicial"),
  def("estacas_por_pilar", "1", "un", "Estacas por pilar", "padrão inicial"),
  def("radier_espessura", "0.12", "m", "Espessura do radier"),
  def("radier_aco", "50", "kg/m³", "Taxa de aço do radier", "padrão inicial"),
  // estrutura
  def("estrutura_concreto", "0.14", "m³/m²", "Concreto de pilares e vigas por m² construído"),
  def("estrutura_aco", "90", "kg/m³", "Taxa de aço da estrutura"),
  def("estrutura_forma", "10", "m²/m³", "Forma por m³ de concreto"),
  def("fator_alvenaria_estrutural", "0.35", "fração", "Fração do concreto da estrutura mantida em alvenaria estrutural (cintas/vergas)", "padrão inicial"),
  def("estrutura_metalica", "35", "kg/m²", "Aço estrutural por m² construído (estrutura metálica)", "padrão inicial"),
  // alvenaria
  def("verga_transpasse", "0.60", "m", "Acréscimo no comprimento de vergas e contravergas por vão"),
  // cobertura
  def("laje_impermeabilizada_rodape", "0.30", "m", "Subida da impermeabilização da laje no perímetro"),
  // impermeabilização
  def("molhada_rodape", "0.30", "m", "Subida da impermeabilização nas paredes de áreas molhadas"),
  def("box_altura", "1.80", "m", "Altura da impermeabilização do box"),
  def("box_perimetro", "2.70", "m", "Perímetro do box"),
  // elétrica
  def("luz_area_por_ponto", "12", "m²", "Área por ponto de luz"),
  def("tug_perimetro_seco", "5", "m", "Perímetro por TUG em salas e quartos"),
  def("tug_perimetro_molhado", "3.5", "m", "Perímetro por TUG em cozinha e serviço"),
  def("eletroduto_por_ponto", "8", "m", "Eletroduto por ponto"),
  def("cabo_por_ponto", "25", "m", "Cabo por ponto"),
  def("gourmet_tug_extras", "2", "un", "TUG extras da área gourmet", "padrão inicial"),
  // hidrossanitária
  def("agua_fria_por_ponto", "6", "m", "Tubulação de água fria por ponto", "padrão inicial"),
  def("agua_quente_por_ponto", "6", "m", "Tubulação de água quente por ponto", "padrão inicial"),
  def("esgoto_por_ponto", "4", "m", "Tubulação de esgoto por ponto", "padrão inicial"),
  def("rede_externa_fator", "0.5", "m/m", "Rede externa de esgoto por metro de perímetro externo", "padrão inicial"),
  def("caixa_inspecao_espacamento", "10", "m", "Uma caixa de inspeção a cada"),
  def("consumo_por_pessoa", "200", "L/dia", "Consumo diário por morador"),
  def("reservatorio_dias", "2", "dias", "Dias de reserva"),
  def("moradores_por_quarto", "2", "pessoas", "Moradores por quarto quando não informado"),
  def("bancada_banheiro", "0.50", "m²", "Bancada por lavatório", "padrão inicial"),
  def("bancada_cozinha", "1.20", "m²", "Bancada por pia de cozinha", "padrão inicial"),
  def("aquecedor_solar_litros_pessoa", "50", "L", "Água quente solar por morador", "padrão inicial"),
  // revestimentos / áreas externas
  def("calcada_largura", "0.60", "m", "Largura da calçada perimetral"),
  def("muro_pilarete_espacamento", "3", "m", "Espaçamento dos pilaretes do muro", "padrão inicial"),
  // piscina
  def("piscina_folga_escavacao", "1", "m", "Acréscimo em comprimento e largura da escavação"),
  def("piscina_sobreprofundidade", "0.30", "m", "Acréscimo de profundidade da escavação"),
  def("piscina_espessura", "0.15", "m", "Espessura de fundo e paredes", "padrão inicial"),
  def("piscina_aco", "100", "kg/m³", "Taxa de aço da piscina", "padrão inicial"),
  def("piscina_recirculacao_h", "6", "h", "Tempo de recirculação para dimensionar filtro e bomba", "padrão inicial"),
  def("piscina_area_por_refletor", "20", "m²", "Área de espelho d'água por refletor", "padrão inicial"),
  // administração e prazo
  def("adm_horas_engenheiro_mes", "40", "h/mês", "Horas de engenheiro por mês de obra", "padrão inicial"),
  def("adm_horas_mestre_mes", "176", "h/mês", "Horas de mestre de obras por mês de obra", "padrão inicial"),
  def("projetos_taxas_pct", "0", "%", "Projetos e taxas sobre o custo direto (0 = não incluir)"),
  def("prazo_base_meses", "3", "meses", "Prazo mínimo da obra", "padrão inicial"),
  def("prazo_meses_por_100m2", "1.5", "meses", "Meses adicionais a cada 100 m² construídos", "padrão inicial"),
] as const satisfies readonly DefinicaoIndice[];

export type ChaveIndice = (typeof INDICES_PADRAO)[number]["chave"];
export type Indices = Readonly<Record<ChaveIndice, Dec>>;

/** Monta os índices a partir dos padrões, sobrescrevendo com os valores do banco/empresa. */
export function criarIndices(sobrescritas: Readonly<Partial<Record<string, ValorDecimal>>> = {}): Indices {
  const saida: Partial<Record<ChaveIndice, Dec>> = {};
  for (const d of INDICES_PADRAO) {
    const v = sobrescritas[d.chave];
    saida[d.chave] = new D(v === undefined || v === null || v === "" ? d.valor : v);
  }
  return saida as Indices;
}
