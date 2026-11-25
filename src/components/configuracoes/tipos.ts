/** Resultado das server actions de Configurações (useActionState e chamadas diretas). */
export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

export const ESTADO_INICIAL: EstadoAcao = {};
