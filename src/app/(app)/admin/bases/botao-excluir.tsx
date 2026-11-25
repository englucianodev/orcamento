"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { excluirBase, type EstadoExclusao } from "./acoes";

const inicial: EstadoExclusao = {};

export function BotaoExcluirBase({ id, rotulo }: { id: string; rotulo: string }) {
  const [estado, acao, enviando] = useActionState(excluirBase, inicial);
  return (
    <form
      action={acao}
      onSubmit={(ev) => {
        if (!window.confirm(`Excluir a base ${rotulo}? Insumos, composições e o arquivo original serão apagados.`)) ev.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="fantasma" disabled={enviando}>{enviando ? "Excluindo…" : "Excluir"}</Button>
      {estado.erro ? <p className="max-w-48 text-right text-xs text-perigo" role="alert">{estado.erro}</p> : null}
    </form>
  );
}
