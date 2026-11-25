"use client";
/** Ações do cabeçalho do orçamento: recalcular, aprovar (gera versão), reabrir e simular desoneração. */
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { aprovar, reabrir, recalcular, simularDesoneracao, type EstadoAcao, type ResultadoSimulacao } from "@/app/(app)/orcamentos/acoes";
import { Button, estiloBotao } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { moeda } from "@/lib/utils";

interface Props {
  orcamentoId: string;
  status: "rascunho" | "revisao" | "aprovado";
  editavel: boolean;
  aprovavel: boolean;
}

function Mensagem({ estado }: { estado: EstadoAcao }) {
  if (estado.erro) return <p className="text-xs text-perigo" role="alert">{estado.erro}</p>;
  if (estado.ok) return <p className="text-xs text-sucesso" role="status">{estado.ok}</p>;
  return null;
}

export function AcoesOrcamento({ orcamentoId, status, editavel, aprovavel }: Props) {
  const [eRec, aRec, pRec] = useActionState<EstadoAcao, FormData>(recalcular, {});
  const [eApr, aApr, pApr] = useActionState<EstadoAcao, FormData>(aprovar, {});
  const [eReab, aReab, pReab] = useActionState<EstadoAcao, FormData>(reabrir, {});
  const [modo, setModo] = useState<"" | "aprovar" | "reabrir">("");
  const [sim, setSim] = useState<ResultadoSimulacao | null>(null);
  const [simulando, iniciarSim] = useTransition();
  const aprovado = status === "aprovado";

  return (
    <div className="nao-imprimir space-y-2">
      <div className="flex flex-wrap gap-2">
        {editavel && !aprovado ? (
          <>
            <Link href={`/orcamentos/${orcamentoId}/assistente`} className={estiloBotao({ variant: "secundario", size: "sm" })}>Editar no assistente</Link>
            <form action={aRec}><input type="hidden" name="id" value={orcamentoId} />
              <Button type="submit" size="sm" variant="secundario" disabled={pRec}>{pRec ? "Recalculando…" : "Recalcular"}</Button>
            </form>
            <Button size="sm" disabled={!aprovavel} title={aprovavel ? undefined : "Há itens sem composição ou sem custo"} onClick={() => setModo(modo === "aprovar" ? "" : "aprovar")}>Aprovar</Button>
          </>
        ) : null}
        {editavel && aprovado ? <Button size="sm" variant="secundario" onClick={() => setModo(modo === "reabrir" ? "" : "reabrir")}>Reabrir (nova versão)</Button> : null}
        <Button size="sm" variant="fantasma" disabled={simulando} onClick={() => iniciarSim(async () => setSim(await simularDesoneracao(orcamentoId)))}>
          {simulando ? "Simulando…" : "Simular desoneração"}
        </Button>
      </div>

      {modo === "aprovar" ? (
        <form action={aApr} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={orcamentoId} />
          <Input name="motivo" placeholder="Observação da versão (opcional)" maxLength={300} className="w-72" aria-label="Observação da aprovação" />
          <Button type="submit" size="sm" disabled={pApr}>{pApr ? "Aprovando…" : "Confirmar aprovação"}</Button>
        </form>
      ) : null}
      {modo === "reabrir" ? (
        <form action={aReab} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={orcamentoId} />
          <Input name="motivo" placeholder="Motivo da nova versão" maxLength={300} className="w-72" aria-label="Motivo da reabertura" />
          <Button type="submit" size="sm" disabled={pReab}>{pReab ? "Reabrindo…" : "Confirmar reabertura"}</Button>
        </form>
      ) : null}
      <Mensagem estado={eRec} /><Mensagem estado={eApr} /><Mensagem estado={eReab} />

      {sim?.erro ? <Alerta tom="perigo">{sim.erro}</Alerta> : null}
      {sim?.atual && sim.alternativa ? (
        <Alerta tom="info" titulo="Simulação (nada foi gravado)">
          <p>{sim.atual.rotulo}: <strong>{moeda(sim.atual.total)}</strong> · {sim.alternativa.rotulo}: <strong>{moeda(sim.alternativa.total)}</strong></p>
          {sim.alternativa.semComposicao > 0 ? <p className="text-xs">{sim.alternativa.semComposicao} item(ns) sem custo na base alternativa.</p> : null}
          {sim.alternativa.avisos.map((a) => <p key={a} className="text-xs">{a}</p>)}
        </Alerta>
      ) : null}
    </div>
  );
}
