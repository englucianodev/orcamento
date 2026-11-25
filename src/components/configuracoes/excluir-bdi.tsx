"use client";
import { useActionState } from "react";
import { excluirBdi } from "@/app/(app)/configuracoes/bdi/acoes";
import { BotaoConfirmar } from "./formulario";
import { ESTADO_INICIAL } from "./tipos";

export function BotaoExcluirBdi({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, enviando] = useActionState(excluirBdi, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col items-start">
      <input type="hidden" name="id" value={id} />
      <BotaoConfirmar
        mensagem={`Excluir o BDI "${nome}"? Orçamentos que o usam ficarão sem esse BDI até você escolher outro.`}
        variant="fantasma"
        size="sm"
        disabled={enviando}
      >
        Excluir
      </BotaoConfirmar>
      {estado.erro ? <p className="max-w-48 text-xs text-perigo" role="alert">{estado.erro}</p> : null}
    </form>
  );
}
