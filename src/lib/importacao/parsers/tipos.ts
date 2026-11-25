/** Tipos dos dados extraídos das planilhas oficiais (antes de gravar no banco). Números como texto decimal. */
export type Fonte = "SINAPI" | "SICRO";
export type TipoInsumo = "MATERIAL" | "MAO_OBRA" | "EQUIPAMENTO" | "SERVICO" | "TRANSPORTE";
export type GrupoSicro = "A" | "B" | "C" | "D" | "E" | "F";

export interface InsumoImportado {
  codigo: string;
  descricao: string;
  unidade: string;
  tipo: TipoInsumo;
  classificacao: string;
  preco: string | null;
  origemPreco: string | null;
}

export interface EquipamentoImportado {
  codigo: string;
  chp: string;
  chi: string;
  depreciacao: string | null;
  juros: string | null;
  manutencao: string | null;
  materiaisOperacao: string | null;
  maoObraOperacao: string | null;
}

export interface ComposicaoImportada {
  codigo: string;
  descricao: string;
  unidade: string;
  grupo: string | null;
  precoPublicado: string | null;
  producaoEquipe: string | null;
  fic: string | null;
  fit: string | null;
}

export interface ItemImportado {
  composicaoCodigo: string;
  tipoItem: "INSUMO" | "COMPOSICAO";
  itemCodigo: string;
  coeficiente: string;
  utilizacaoOperativa: string | null;
  utilizacaoImprodutiva: string | null;
  grupoSicro: GrupoSicro | null;
  /** SICRO F: códigos das composições de transporte por tipo de via; E/F: material transportado */
  extra: Record<string, string> | null;
}

export interface EncargosImportados {
  horistaPct: string | null;
  mensalistaPct: string | null;
}

export interface BaseImportada {
  fonte: Fonte;
  layout: string;
  uf: string;
  /** primeiro dia do mês, formato AAAA-MM-01 */
  mesAno: string;
  desonerado: boolean;
  insumos: InsumoImportado[];
  equipamentos: EquipamentoImportado[];
  composicoes: ComposicaoImportada[];
  itens: ItemImportado[];
  encargos: EncargosImportados;
  avisos: string[];
}

export class LayoutDesconhecidoError extends Error {
  constructor(
    message: string,
    public readonly cabecalhosEncontrados: string[][],
  ) {
    super(message);
    this.name = "LayoutDesconhecidoError";
  }
}
