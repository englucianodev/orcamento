/** Tipos compartilhados entre a página de mapeamento (servidor) e o editor (navegador). */
import type { Padrao } from "@/lib/engine/entrada.schema";
import type { FonteMapeamento } from "@/lib/orcamento/precificar";

export interface BaseOpcao {
  id: string;
  fonte: "SINAPI" | "SICRO";
  rotulo: string;
}

export interface ItemCatalogo {
  chave: string;
  descricao: string;
  unidade: string;
  etapa: string;
  ordem: number | null;
}

export interface InfoComposicao {
  descricao: string | null;
  unidade: string | null;
}

/** Linha de mapeamento da própria empresa, editável. */
export interface LinhaEmpresa {
  id: string;
  padrao: Padrao | null;
  fonte: FonteMapeamento;
  codigo: string;
  fatorConversao: string;
}

export interface Sugestao {
  codigo: string;
  descricao: string | null;
  unidade: string | null;
  preco: string | null;
  relevancia: string | null;
}
