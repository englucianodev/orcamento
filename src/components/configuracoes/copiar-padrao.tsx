"use client";
import { useActionState } from "react";
import { copiarMapeamentoPadrao } from "@/app/(app)/configuracoes/mapeamento/acoes";
import { Campo, Select } from "@/components/ui/form";
import { PADROES } from "@/lib/engine/entrada.schema";
import { copiaPadraoSchema } from "./esquemas";
import { BotaoConfirmar, MensagemEstado, useValidacaoCliente } from "./formulario";
import { ROTULO_PADRAO } from "./rotulos";
import { ESTADO_INICIAL } from "./tipos";

/** Copia os mapeamentos específicos da empresa de um padrão para outro. */
export function CopiarPadrao() {
  const [estado, acao, enviando] = useActionState(copiarMapeamentoPadrao, ESTADO_INICIAL);
  const { erroCliente, aoEnviar } = useValidacaoCliente(copiaPadraoSchema);
  return (
    <form action={acao} onSubmit={aoEnviar} className="flex flex-col gap-3">
      <MensagemEstado estado={estado} erroCliente={erroCliente} />
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Do padrão" htmlFor="copia-origem">
          <Select id="copia-origem" name="origem" defaultValue="normal">
            {PADROES.map((p) => <option key={p} value={p}>{ROTULO_PADRAO[p]}</option>)}
          </Select>
        </Campo>
        <Campo rotulo="Para o padrão" htmlFor="copia-destino">
          <Select id="copia-destino" name="destino" defaultValue="alto">
            {PADROES.map((p) => <option key={p} value={p}>{ROTULO_PADRAO[p]}</option>)}
          </Select>
        </Campo>
        <BotaoConfirmar mensagem="Copiar os mapeamentos da empresa? Linhas do padrão de destino com a mesma chave e fonte serão substituídas." variant="secundario" disabled={enviando}>
          Copiar
        </BotaoConfirmar>
      </div>
    </form>
  );
}
