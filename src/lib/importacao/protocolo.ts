/** Mensagens trocadas entre a página /admin/bases e o Web Worker de leitura das planilhas. */
import type { UF } from "./parsers/util";
import type { BaseImportada } from "./parsers/tipos";
import type { ResultadoValidacao } from "./validacao";

export type EtapaLeitura = "arquivos" | "hash" | "planilhas" | "insumos" | "composicoes" | "itens" | "validacao";

export const ROTULO_ETAPA_LEITURA: Record<EtapaLeitura, string> = {
  arquivos: "Abrindo arquivos",
  hash: "Calculando SHA-256",
  planilhas: "Abrindo planilhas",
  insumos: "Lendo insumos",
  composicoes: "Lendo composições",
  itens: "Lendo itens das composições",
  validacao: "Recalculando composições (validação)",
};

export interface PedidoLeitura {
  tipo: "ler";
  arquivos: File[];
  fonte: "SINAPI" | "SICRO";
  uf: UF;
  desonerado: boolean;
}

export type MensagemDoWorker =
  | { tipo: "progresso"; etapa: EtapaLeitura }
  | { tipo: "concluido"; hash: string; base: BaseImportada; validacao: ResultadoValidacao }
  | { tipo: "erro"; mensagem: string; cabecalhos?: string[][] };

export function ehEtapaLeitura(valor: string): valor is EtapaLeitura {
  return Object.prototype.hasOwnProperty.call(ROTULO_ETAPA_LEITURA, valor);
}
