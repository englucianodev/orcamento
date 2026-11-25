"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { criarOrcamento, excluirOrcamento, type EstadoAcao } from "../orcamentos/acoes";

export function FormularioNovoOrcamento() {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(criarOrcamento, {});
  return (
    <form action={acao} className="flex flex-wrap items-start gap-2">
      <div>
        <label htmlFor="nome-orcamento" className="sr-only">Nome da obra</label>
        <Input id="nome-orcamento" name="nome" placeholder="Nome da obra (ex.: Residência Silva)" required minLength={2} maxLength={120} className="w-72"
          aria-invalid={Boolean(estado.erro)} aria-describedby={estado.erro ? "erro-novo" : undefined} />
        {estado.erro ? <p id="erro-novo" className="mt-1 text-xs text-perigo" role="alert">{estado.erro}</p> : null}
      </div>
      <Button type="submit" disabled={pendente}>{pendente ? "Criando…" : "Novo orçamento"}</Button>
    </form>
  );
}

export function BotaoExcluir({ id, nome }: { id: string; nome: string }) {
  return (
    <form action={excluirOrcamento} onSubmit={(e) => { if (!window.confirm(`Excluir o orçamento "${nome}"? Esta ação não pode ser desfeita.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="fantasma" className="text-perigo">Excluir</Button>
    </form>
  );
}
