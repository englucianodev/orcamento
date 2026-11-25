"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { Campo, Input } from "@/components/ui/form";
import { cadastrar, entrar, enviarLinkMagico, type EstadoAuth } from "./acoes";

const inicial: EstadoAuth = {};

function Mensagens({ estado }: { estado: EstadoAuth }) {
  if (estado.erro) return <Alerta tom="perigo">{estado.erro}</Alerta>;
  if (estado.aviso) return <Alerta tom="sucesso">{estado.aviso}</Alerta>;
  return null;
}

export function FormularioEntrar({ voltar }: { voltar: string }) {
  const [modo, setModo] = useState<"senha" | "link">("senha");
  const [estadoSenha, acaoSenha, enviandoSenha] = useActionState(entrar, inicial);
  const [estadoLink, acaoLink, enviandoLink] = useActionState(enviarLinkMagico, inicial);
  const estado = modo === "senha" ? estadoSenha : estadoLink;
  return (
    <form action={modo === "senha" ? acaoSenha : acaoLink} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />
      <Mensagens estado={estado} />
      <Campo rotulo="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Campo>
      {modo === "senha" ? (
        <Campo rotulo="Senha" htmlFor="senha">
          <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
        </Campo>
      ) : null}
      <Button type="submit" disabled={enviandoSenha || enviandoLink}>
        {modo === "senha" ? "Entrar" : "Enviar link de acesso"}
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-acento hover:underline" onClick={() => setModo(modo === "senha" ? "link" : "senha")}>
          {modo === "senha" ? "Entrar com link por e-mail" : "Entrar com senha"}
        </button>
        <Link href={`/cadastro?voltar=${encodeURIComponent(voltar)}`} className="text-acento hover:underline">Criar conta</Link>
      </div>
    </form>
  );
}

export function FormularioCadastro({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState(cadastrar, inicial);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />
      <Mensagens estado={estado} />
      <Campo rotulo="Nome" htmlFor="nome">
        <Input id="nome" name="nome" autoComplete="name" required />
      </Campo>
      <Campo rotulo="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Campo>
      <Campo rotulo="Senha" htmlFor="senha" ajuda="Mínimo de 8 caracteres.">
        <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Button type="submit" disabled={enviando}>Criar conta</Button>
      <p className="text-center text-sm text-suave">
        Já tem conta? <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="text-acento hover:underline">Entrar</Link>
      </p>
    </form>
  );
}
