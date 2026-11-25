"use client";
/** Quantidade editável na planilha: grava, recalcula o orçamento e mantém a marca de "editada". */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editarQuantidade, restaurarQuantidade } from "@/app/(app)/orcamentos/acoes";
import type { LinhaPlanilha } from "@/lib/orcamento/visao";
import { numero } from "@/lib/utils";

export function CelulaQuantidade({ orcamentoId, linha, editavel }: { orcamentoId: string; linha: LinhaPlanilha; editavel: boolean }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(linha.quantidade);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const executar = (acao: () => Promise<{ erro?: string }>) => iniciar(async () => {
    const r = await acao();
    setErro(r.erro ?? null);
    if (!r.erro) { setEditando(false); router.refresh(); }
  });

  const salvar = () => {
    if (valor.trim() === linha.quantidade) { setEditando(false); return; }
    executar(() => editarQuantidade(orcamentoId, linha.id, valor));
  };

  if (!editavel) return <span className="font-mono tabular-nums">{numero(linha.quantidade, linha.unidade === "%" ? 2 : 4)}</span>;
  if (!editando) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button type="button" onClick={() => { setValor(linha.quantidade); setEditando(true); }} disabled={pendente}
          className="rounded px-1 font-mono tabular-nums underline decoration-dotted underline-offset-4 hover:bg-fundo" title="Editar quantidade">
          {pendente ? "…" : numero(linha.quantidade, 4)}
        </button>
        {linha.editado ? (
          <button type="button" className="text-[11px] text-acento hover:underline" disabled={pendente}
            onClick={() => executar(() => restaurarQuantidade(orcamentoId, linha.id))}>restaurar calculada</button>
        ) : null}
        {erro ? <span className="text-[11px] text-perigo" role="alert">{erro}</span> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      <input autoFocus aria-label={`Quantidade de ${linha.descricao}`} value={valor} inputMode="decimal" disabled={pendente}
        onChange={(e) => setValor(e.target.value)} onBlur={salvar}
        onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(false); }}
        className="h-8 w-28 rounded border border-acento bg-superficie px-2 text-right font-mono text-sm" />
      {erro ? <span className="text-[11px] text-perigo" role="alert">{erro}</span> : null}
    </div>
  );
}
