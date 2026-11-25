"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/form";
import { convidar, criarEmpresa, type EstadoAcao } from "./acoes-empresa";

const inicial: EstadoAcao = {};

export function FormularioNovaEmpresa() {
  const [estado, acao, enviando] = useActionState(criarEmpresa, inicial);
  return (
    <form action={acao} className="flex max-w-md flex-col gap-4">
      {estado.erro ? <Alerta tom="perigo">{estado.erro}</Alerta> : null}
      <Campo rotulo="Nome da empresa" htmlFor="nome"><Input id="nome" name="nome" required /></Campo>
      <Campo rotulo="CNPJ (opcional)" htmlFor="cnpj"><Input id="cnpj" name="cnpj" inputMode="numeric" /></Campo>
      <Button type="submit" disabled={enviando}>Criar empresa</Button>
    </form>
  );
}

export function FormularioConvite({ empresaId }: { empresaId: string }) {
  const [estado, acao, enviando] = useActionState(convidar, inicial);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="empresa" value={empresaId} />
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="E-mail" htmlFor="email-convite" className="min-w-56 flex-1"><Input id="email-convite" name="email" type="email" required /></Campo>
        <Campo rotulo="Papel" htmlFor="papel-convite">
          <Select id="papel-convite" name="papel" defaultValue="orcamentista">
            <option value="admin">Administrador</option>
            <option value="orcamentista">Orçamentista</option>
            <option value="leitor">Leitor</option>
          </Select>
        </Campo>
        <Button type="submit" disabled={enviando}>Gerar convite</Button>
      </div>
      {estado.erro ? <Alerta tom="perigo">{estado.erro}</Alerta> : null}
      {estado.ok ? (
        <Alerta tom="sucesso" titulo="Convite criado. Envie este link à pessoa convidada:">
          <code className="break-all font-mono text-xs">{estado.ok}</code>
        </Alerta>
      ) : null}
    </form>
  );
}
