/**
 * Modelo serializável dos relatórios (seção 11): cada valor numérico traz o texto pt-BR para o PDF
 * e o texto decimal ("1234.56") para as células numéricas do Excel. Nada de float com dinheiro.
 */
import { formatarBr, type Dec } from "../engine/decimal";

/** Valor do relatório: `br` para exibir ("1.234,56" / "—"), `n` decimal para o Excel (null = sem valor). */
export interface Num {
  br: string;
  n: string | null;
}

export const VAZIO: Num = { br: "—", n: null };

/** Dinheiro/quantidade: texto com `casas` e decimal com `casasN` (padrão: as mesmas). */
export function num(v: Dec | null | undefined, casas = 2, casasN = casas): Num {
  return v ? { br: formatarBr(v, casas), n: v.toFixed(casasN) } : VAZIO;
}

/** Fração → percentual ("22,12%"); no Excel fica a fração (formato 0,00%). */
export function pct(fracao: Dec | null | undefined, casas = 2): Num {
  return fracao ? { br: `${formatarBr(fracao.times(100), casas)}%`, n: fracao.toDecimalPlaces(casas + 4).toFixed() } : VAZIO;
}

/** Coeficientes: entre 2 e 7 casas, conforme a precisão publicada. */
export function coef(v: Dec | null | undefined): Num {
  if (!v) return VAZIO;
  const casas = Math.min(Math.max(v.decimalPlaces(), 2), 7);
  return { br: formatarBr(v, casas), n: v.toFixed(casas) };
}

export interface Responsavel {
  nome: string;
  registro: string;
  art: string;
}

export interface CabecalhoRelatorio {
  empresa: { nome: string; cnpj: string };
  obra: string;
  cliente: string;
  uf: string;
  municipio: string;
  padrao: string;
  versao: number;
  status: string;
  dataEmissao: string;
  /** rótulos das bases (ex.: "SINAPI PI 10/2026 não desonerado") */
  datasBase: string[];
  desoneracao: string;
  bdiServico: Num;
  bdiMaterial: Num;
  /** null = sem responsável informado (o documento mostra linha de assinatura em branco) */
  responsavel: Responsavel | null;
}

export interface LinhaSintetica {
  id: string;
  numero: string;
  /** "SINAPI 12345", "SICRO 123", "PRÓPRIA X" ou "—" */
  fonteCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: Num;
  custoUnitario: Num;
  precoUnitario: Num;
  custoTotal: Num;
  total: Num;
  bdiTipo: "Serviço" | "Material";
  percentual: boolean;
  semComposicao: boolean;
  alerta: string | null;
  /** chave em `composicoes` ("SINAPI 12345") ou null */
  chaveComposicao: string | null;
}

export interface EtapaSintetica {
  id: string;
  ordem: number;
  nome: string;
  itens: LinhaSintetica[];
  custo: Num;
  subtotal: Num;
}

export interface PlanilhaSintetica {
  etapas: EtapaSintetica[];
  custoDireto: Num;
  total: Num;
  semComposicao: number;
}

export interface LinhaResumoEtapa {
  ordem: number;
  nome: string;
  custo: Num;
  total: Num;
  percentual: Num;
}

export interface Indicadores {
  custoDireto: Num;
  valorBdi: Num;
  total: Num;
  area: Num;
  custoM2: Num;
  cub: Num;
  /** custo/m² ÷ CUB − 1 */
  diferencaCub: Num;
  prazoMeses: number | null;
}

export interface LinhaAbcRelatorio {
  posicao: number;
  numero: string;
  fonteCodigo: string;
  descricao: string;
  total: Num;
  percentual: Num;
  acumulado: Num;
  classe: "A" | "B" | "C";
}

export interface CurvaAbcRelatorio {
  linhas: LinhaAbcRelatorio[];
  classes: Array<{ classe: "A" | "B" | "C"; itens: number; total: Num; percentual: Num }>;
}

export interface CronogramaRelatorio {
  meses: string[];
  linhas: Array<{ nome: string; total: Num; valores: Num[] }>;
  totaisMes: Num[];
  acumulado: Num[];
  percentualAcumulado: Num[];
  total: Num;
  /** etapas com valor mas sem distribuição gravada no cronograma */
  semDistribuicao: string[];
}

export interface ComponenteBdiRelatorio {
  sigla: string;
  nome: string;
  valor: Num;
  referencia: string;
}

export interface QuadroBdi {
  rotulo: string;
  nome: string;
  tipoObra: string;
  componentes: ComponenteBdiRelatorio[];
  taxa: Num;
  referenciaTaxa: string;
  alertas: string[];
}

export interface LinhaEncargos {
  base: string;
  horista: Num;
  mensalista: Num;
}

export interface MemoriaAmbiente {
  id: string | null;
  nome: string;
  itens: Array<{ numero: string; descricao: string; unidade: string; quantidade: Num; memoria: string }>;
}

export interface LinhaComposicao {
  /** INSUMO / COMPOSICAO (SINAPI) ou grupo A–F (SICRO) */
  grupo: string;
  codigo: string;
  descricao: string;
  unidade: string;
  coeficiente: Num;
  precoUnitario: Num;
  total: Num;
}

export interface ComposicaoRelatorio {
  chave: string;
  fonteCodigo: string;
  descricao: string;
  unidade: string;
  custo: Num;
  linhas: LinhaComposicao[];
  /** SICRO: custo horário, execução, FIC, grupos C–F */
  resumo: Array<{ rotulo: string; valor: Num }>;
  faltantes: string[];
}

export interface ModeloRelatorio {
  cabecalho: CabecalhoRelatorio;
  sintetica: PlanilhaSintetica;
  resumoEtapas: LinhaResumoEtapa[];
  indicadores: Indicadores;
  abc: CurvaAbcRelatorio;
  cronograma: CronogramaRelatorio;
  bdi: { quadros: QuadroBdi[]; encargos: LinhaEncargos[] };
  memoria: MemoriaAmbiente[];
  composicoes: ComposicaoRelatorio[];
  avisos: string[];
}
