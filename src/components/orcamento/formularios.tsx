"use client";
/** Formulários das abas do orçamento: troca de BDI e reprecificação para outra data-base. */
import { useActionState } from "react";
import { definirBdi, reprecificar, type EstadoAcao } from "@/app/(app)/orcamentos/acoes";
import { Button } from "@/components/ui/button";
import { Campo, Select } from "@/components/ui/form";
import { mesAno } from "@/lib/utils";

function Retorno({ e }: { e: EstadoAcao }) {
  if (e.erro) return <p className="text-xs text-perigo" role="alert">{e.erro}</p>;
  return e.ok ? <p className="text-xs text-sucesso" role="status">{e.ok}</p> : null;
}

export interface OpcaoBdiForm { id: string; rotulo: string; tipo: "servico" | "material" }

export function FormularioBdi({ orcamentoId, opcoes, servicoId, materialId, desabilitado }: {
  orcamentoId: string; opcoes: OpcaoBdiForm[]; servicoId: string | null; materialId: string | null; desabilitado: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(definirBdi, {});
  const lista = (tipo: OpcaoBdiForm["tipo"]) => opcoes.filter((o) => o.tipo === tipo).map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="id" value={orcamentoId} />
      <Campo rotulo="BDI de serviços" htmlFor="bdi-servico">
        <Select id="bdi-servico" name="servico" defaultValue={servicoId ?? ""} disabled={desabilitado}><option value="">Automático</option>{lista("servico")}</Select>
      </Campo>
      <Campo rotulo="BDI de materiais/equipamentos" htmlFor="bdi-material">
        <Select id="bdi-material" name="material" defaultValue={materialId ?? ""} disabled={desabilitado}><option value="">Automático</option>{lista("material")}</Select>
      </Campo>
      <Button type="submit" disabled={pendente || desabilitado}>{pendente ? "Aplicando…" : "Aplicar e recalcular"}</Button>
      <div className="sm:col-span-3"><Retorno e={estado} /></div>
    </form>
  );
}

export function FormularioReprecificar({ orcamentoId, meses, mesesSicro, atual, desabilitado }: {
  orcamentoId: string; meses: string[]; mesesSicro: string[];
  atual: { mes_base: string | null; mes_base_sicro: string | null; desonerado: boolean }; desabilitado: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(reprecificar, {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <input type="hidden" name="id" value={orcamentoId} />
      <Campo rotulo="Mês-base SINAPI" htmlFor="rep-mes">
        <Select id="rep-mes" name="mes_base" defaultValue={atual.mes_base ?? ""} required disabled={desabilitado}>
          <option value="" disabled>Selecione…</option>
          {meses.map((m) => <option key={m} value={m}>{mesAno(m)}</option>)}
        </Select>
      </Campo>
      <Campo rotulo="Mês-base SICRO" htmlFor="rep-sicro">
        <Select id="rep-sicro" name="mes_base_sicro" defaultValue={atual.mes_base_sicro ?? ""} disabled={desabilitado}>
          <option value="">Igual ao SINAPI</option>
          {mesesSicro.map((m) => <option key={m} value={m}>{mesAno(m)}</option>)}
        </Select>
      </Campo>
      <Campo rotulo="Encargos" htmlFor="rep-des">
        <Select id="rep-des" name="desonerado" defaultValue={atual.desonerado ? "sim" : "nao"} disabled={desabilitado}>
          <option value="nao">Não desonerado</option><option value="sim">Desonerado</option>
        </Select>
      </Campo>
      <Button type="submit" disabled={pendente || desabilitado || meses.length === 0}>{pendente ? "Reprecificando…" : "Reprecificar"}</Button>
      <div className="sm:col-span-4"><Retorno e={estado} /></div>
    </form>
  );
}
