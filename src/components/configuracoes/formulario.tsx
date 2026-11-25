"use client";
import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { primeiroErro } from "./esquemas";
import type { EstadoAcao } from "./tipos";

type Montador = (form: FormData) => unknown;

/**
 * Validação Zod no navegador antes de enviar a server action (que valida de novo).
 * Se inválido, cancela o envio e devolve a mensagem.
 */
export function useValidacaoCliente(schema: z.ZodType, montar?: Montador) {
  const [erro, setErro] = useState<string | null>(null);
  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    const dados = new FormData(e.currentTarget);
    const r = schema.safeParse(montar ? montar(dados) : Object.fromEntries(dados));
    if (!r.success) {
      e.preventDefault();
      setErro(primeiroErro(r.error));
      return;
    }
    setErro(null);
  };
  return { erroCliente: erro, aoEnviar };
}

export function MensagemEstado({ estado, erroCliente }: { estado: EstadoAcao; erroCliente?: string | null }) {
  if (erroCliente) return <Alerta tom="perigo">{erroCliente}</Alerta>;
  if (estado.erro) return <Alerta tom="perigo">{estado.erro}</Alerta>;
  if (estado.ok) return <Alerta tom="sucesso">{estado.ok}</Alerta>;
  return null;
}

/** Botão de envio que pede confirmação (exclusões e restaurações). */
export function BotaoConfirmar({ mensagem, children, ...props }: ButtonProps & { mensagem: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(mensagem)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
