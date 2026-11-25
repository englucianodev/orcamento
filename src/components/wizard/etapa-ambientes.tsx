"use client";
/** Passo 4: ambientes por cômodo — atalho ("3 quartos, 1 suíte…"), adicionar, duplicar, editar vãos. */
import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Alerta, Badge } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { interpretarAtalho, sugerirAmbiente } from "@/lib/engine/padroes";
import type { Padrao, TipoAmbiente } from "@/lib/engine/entrada.schema";
import { numero } from "@/lib/utils";
import { EditorAmbiente } from "./editor-ambiente";
import { R, rotulo } from "./rotulos";
import { novoId, type ValoresAssistente } from "./valores";

type AmbienteForm = ValoresAssistente["entrada"]["ambientes"][number];

function area(a: Partial<AmbienteForm>): number | null {
  if (typeof a.largura === "number" && typeof a.comprimento === "number") return a.largura * a.comprimento;
  return typeof a.areaManual === "number" ? a.areaManual : null;
}

export function EtapaAmbientes() {
  const { control, getValues, formState } = useFormContext<ValoresAssistente>();
  const { fields, append, remove, insert } = useFieldArray({ control, name: "entrada.ambientes", keyName: "_chave" });
  const ambientes = useWatch({ control, name: "entrada.ambientes" }) ?? [];
  const pavimentos = Number(useWatch({ control, name: "entrada.dadosGerais.pavimentos" }) ?? 1);
  const padrao = (useWatch({ control, name: "entrada.dadosGerais.padrao" }) ?? "normal") as Padrao;
  const [atalho, setAtalho] = useState("");
  const [pavimento, setPavimento] = useState(1);
  const [tipoNovo, setTipoNovo] = useState<TipoAmbiente>("quarto");
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const criar = (tipo: TipoAmbiente, contagem: Map<string, number>) => {
    const n = (contagem.get(tipo) ?? 0) + 1;
    contagem.set(tipo, n);
    return sugerirAmbiente(tipo, padrao, novoId(), n, Math.min(pavimento, pavimentos));
  };
  const contagemAtual = () => {
    const m = new Map<string, number>();
    for (const a of getValues("entrada.ambientes") ?? []) m.set(a.tipo, (m.get(a.tipo) ?? 0) + 1);
    return m;
  };

  const aplicarAtalho = () => {
    const pedidos = interpretarAtalho(atalho);
    if (pedidos.length === 0) {
      setAviso('Não reconheci ambientes. Exemplo: "3 quartos, 1 suíte, 2 banheiros, sala, cozinha".');
      return;
    }
    const contagem = contagemAtual();
    append(pedidos.flatMap((p) => Array.from({ length: p.quantidade }, () => criar(p.tipo, contagem))));
    setAviso(null);
    setAtalho("");
  };

  const duplicar = (i: number) => {
    const a = getValues(`entrada.ambientes.${i}`);
    const id = novoId();
    insert(i + 1, { ...a, id, nome: `${a.nome} (cópia)`, vaos: (a.vaos ?? []).map((v, j) => ({ ...v, id: `${id}-v${j + 1}` })) });
  };

  const erroLista = (formState.errors.entrada?.ambientes as { message?: string; root?: { message?: string } } | undefined);
  const total = ambientes.reduce((s, a) => s + (area(a) ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-md border border-borda p-4">
        <Label htmlFor="atalho">Atalho: descreva os cômodos e ajuste as medidas sugeridas depois</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="atalho" value={atalho} onChange={(e) => setAtalho(e.target.value)} className="min-w-64 flex-1"
            placeholder="3 quartos, 1 suíte, 2 banheiros, sala, cozinha, área de serviço, garagem"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarAtalho(); } }} />
          {pavimentos > 1 ? (
            <Select aria-label="Pavimento" value={pavimento} onChange={(e) => setPavimento(Number(e.target.value))} className="w-36">
              {Array.from({ length: pavimentos }, (_, p) => <option key={p} value={p + 1}>{p + 1}º pavimento</option>)}
            </Select>
          ) : null}
          <Button variant="secundario" onClick={aplicarAtalho}>Gerar ambientes</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Tipo do ambiente" value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value as TipoAmbiente)} className="w-52">
            {R.tipoAmbiente.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Select>
          <Button variant="fantasma" onClick={() => { const a = criar(tipoNovo, contagemAtual()); append(a); setAberto(a.id); }}>+ Adicionar um ambiente</Button>
        </div>
        {aviso ? <p className="text-xs text-aviso" role="status">{aviso}</p> : null}
      </div>

      {erroLista?.message || erroLista?.root?.message ? <Alerta tom="perigo">{erroLista.message ?? erroLista.root?.message}</Alerta> : null}

      {fields.length === 0 ? (
        <p className="text-sm text-suave">Nenhum ambiente ainda. Use o atalho acima.</p>
      ) : (
        <ul className="space-y-2">
          {fields.map((f, i) => {
            const a = ambientes[i] ?? f;
            const ar = area(a);
            const comErro = Boolean(formState.errors.entrada?.ambientes?.[i]);
            const id = (a as AmbienteForm).id;
            return (
              <li key={f._chave} className={`rounded-md border ${comErro ? "border-perigo" : "border-borda"}`}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={aberto === id}
                    onClick={() => setAberto(aberto === id ? null : id)}>
                    <span className="font-medium">{a.nome || "Sem nome"}</span>
                    <Badge>{rotulo(R.tipoAmbiente, a.tipo)}</Badge>
                    {pavimentos > 1 ? <Badge tom="info">{a.pavimento}º pav.</Badge> : null}
                    {comErro ? <Badge tom="perigo">revisar</Badge> : null}
                    <span className="ml-auto font-mono text-xs text-suave">{ar === null ? "—" : `${numero(ar)} m²`}</span>
                  </button>
                  <Button size="sm" variant="fantasma" onClick={() => duplicar(i)}>Duplicar</Button>
                  <Button size="sm" variant="fantasma" className="text-perigo" onClick={() => remove(i)}>Remover</Button>
                </div>
                {aberto === id || comErro ? <div className="border-t border-borda p-3"><EditorAmbiente indice={i} pavimentos={pavimentos} /></div> : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-right text-sm text-suave">{fields.length} ambiente(s) · Σ áreas úteis {numero(total)} m²</p>
    </div>
  );
}
