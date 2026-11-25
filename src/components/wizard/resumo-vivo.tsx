"use client";
/** Resumo ao vivo do assistente: áreas, projeção e ocupação do terreno, calculados pelo motor no navegador. */
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ambienteSchema, construcaoSchema, type Entrada } from "@/lib/engine/entrada.schema";
import { geometriaObra } from "@/lib/engine/geometria";
import { criarIndices } from "@/lib/engine/indices";
import { moeda, numero } from "@/lib/utils";
import { R, rotulo } from "./rotulos";
import type { ValoresAssistente } from "./valores";

export function ResumoVivo({ indices }: { indices: Record<string, string> }) {
  const { control } = useFormContext<ValoresAssistente>();
  const entrada = useWatch({ control, name: "entrada" });
  const cub = useWatch({ control, name: "meta.cub_m2" });
  const idx = useMemo(() => criarIndices(indices), [indices]);
  const r = useMemo(() => {
    const ambientes = (entrada.ambientes ?? []).flatMap((a) => {
      const p = ambienteSchema.safeParse(a);
      return p.success ? [p.data] : [];
    });
    const construcao = construcaoSchema.safeParse(entrada.construcao ?? {});
    const pavimentos = Math.max(1, Number(entrada.dadosGerais?.pavimentos) || 1);
    const geo = ambientes.length && construcao.success
      ? geometriaObra({ dadosGerais: { pavimentos }, construcao: construcao.data, ambientes } as unknown as Entrada, idx)
      : null;
    const terreno = Number(entrada.terreno?.largura) * Number(entrada.terreno?.profundidade);
    return { geo, ambientes: ambientes.length, invalidos: (entrada.ambientes?.length ?? 0) - ambientes.length, terreno: Number.isFinite(terreno) && terreno > 0 ? terreno : null };
  }, [entrada, idx]);
  const util = r.geo ? r.geo.ambientes.reduce((s, g) => s + g.area.toNumber(), 0) : 0;
  const ocupacao = r.geo && r.terreno ? (r.geo.terreo.projecao.toNumber() / r.terreno) * 100 : null;

  const linhas: Array<[string, string]> = [
    ["Padrão", rotulo(R.padrao, entrada.dadosGerais?.padrao)],
    ["Ambientes", `${r.ambientes}${r.invalidos > 0 ? ` (+${r.invalidos} incompleto)` : ""}`],
    ["Σ áreas úteis", `${numero(util)} m²`],
    ["Área construída", r.geo ? `${numero(r.geo.areaConstruida.toNumber())} m²` : "—"],
    ["Terreno", r.terreno ? `${numero(r.terreno)} m²` : "—"],
    ["Ocupação do térreo", ocupacao === null ? "—" : `${numero(ocupacao, 1)}%`],
    ["Custo estimado (CUB)", r.geo && typeof cub === "number" && cub > 0 ? moeda(r.geo.areaConstruida.times(cub).toFixed(2)) : "—"],
  ];
  return (
    <aside aria-label="Resumo da obra" className="rounded-lg border border-borda bg-superficie p-4 text-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-suave">Resumo da obra</h2>
      <dl className="space-y-1.5">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3"><dt className="text-suave">{k}</dt><dd className="text-right font-mono tabular-nums">{v}</dd></div>
        ))}
      </dl>
      {ocupacao !== null && ocupacao > 100 ? <p className="mt-3 text-xs text-perigo">A projeção do térreo passa da área do terreno.</p> : null}
      <p className="mt-3 text-[11px] text-suave">O custo estimado usa área × CUB informado no passo 1; o custo real sai da planilha gerada no passo 9.</p>
      {r.geo ? <p className="mt-3 font-mono text-[11px] leading-snug text-suave">{r.geo.terreo.memoriaProjecao}</p> : null}
    </aside>
  );
}
