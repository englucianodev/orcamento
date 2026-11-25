"use client";
/**
 * Planilha orçamentária (TanStack Table): agrupada por etapa, filtro por ambiente e busca,
 * edição de quantidade na própria célula e memória de cálculo por item.
 */
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable, type ExpandedState,
} from "@tanstack/react-table";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import type { LinhaPlanilha } from "@/lib/orcamento/visao";
import { cn, moeda, numero } from "@/lib/utils";
import { CelulaQuantidade } from "./celula-quantidade";

export interface PropsPlanilha {
  orcamentoId: string;
  linhas: LinhaPlanilha[];
  totaisEtapa: Record<string, string>;
  editavel: boolean;
  links: { SINAPI: string | null; SICRO: string | null };
}

const col = createColumnHelper<LinhaPlanilha>();

function linkComposicao(l: LinhaPlanilha, links: PropsPlanilha["links"]): string | null {
  if (!l.codigo || !l.fonte) return null;
  if (l.fonte === "PROPRIA") return `/bases?fonte=PROPRIA&composicao=${encodeURIComponent(l.codigo)}`;
  const base = links[l.fonte as "SINAPI" | "SICRO"];
  return base ? `/bases?base=${base}&composicao=${encodeURIComponent(l.codigo)}` : null;
}

export function Planilha({ orcamentoId, linhas, totaisEtapa, editavel, links }: PropsPlanilha) {
  const [busca, setBusca] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [expandido, setExpandido] = useState<ExpandedState>({});

  const ambientes = useMemo(
    () => [...new Map(linhas.filter((l) => l.ambienteId).map((l) => [l.ambienteId!, l.ambiente ?? l.ambienteId!])).entries()],
    [linhas],
  );
  const dados = useMemo(
    () => linhas.filter((l) => (!ambiente || (ambiente === "_geral" ? !l.ambienteId : l.ambienteId === ambiente)) && (!soPendentes || l.alerta)),
    [linhas, ambiente, soPendentes],
  );

  const colunas = useMemo(() => [
    col.accessor("numero", { header: "Item", cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span> }),
    col.accessor((l) => `${l.fonte ?? ""} ${l.codigo ?? ""}`, {
      id: "codigo", header: "Fonte / código",
      cell: ({ row: { original: l } }) => {
        const href = linkComposicao(l, links);
        if (!l.codigo) return <Badge tom="perigo">sem composição</Badge>;
        return href ? <Link href={href} className="font-mono text-xs text-acento hover:underline">{l.fonte} {l.codigo}</Link> : <span className="font-mono text-xs">{l.fonte} {l.codigo}</span>;
      },
    }),
    col.accessor((l) => `${l.descricao} ${l.ambiente ?? ""}`, {
      id: "descricao", header: "Descrição",
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div className="min-w-64">
            <p>{l.descricao}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              {l.ambiente ? <span className="text-suave">{l.ambiente}</span> : null}
              {l.editado ? <Badge tom="info">quantidade editada</Badge> : null}
              {l.alerta ? <Badge tom="aviso">{l.alerta}</Badge> : null}
              {l.memoria ? (
                <button type="button" className="text-acento hover:underline" aria-expanded={row.getIsExpanded()} onClick={row.getToggleExpandedHandler()}>
                  {row.getIsExpanded() ? "ocultar memória" : "memória de cálculo"}
                </button>
              ) : null}
            </div>
          </div>
        );
      },
    }),
    col.accessor("unidade", { header: "Un." }),
    col.accessor("quantidade", {
      header: "Quantidade",
      cell: ({ row: { original: l } }) => <CelulaQuantidade orcamentoId={orcamentoId} linha={l} editavel={editavel && l.unidade !== "%"} />,
    }),
    col.accessor("custoUnitario", { header: "Custo unit.", cell: (c) => <span className="font-mono tabular-nums">{numero(c.getValue(), 4)}</span> }),
    col.accessor("precoUnitario", { header: "Preço unit. c/ BDI", cell: (c) => <span className="font-mono tabular-nums">{numero(c.getValue(), 4)}</span> }),
    col.accessor("total", { header: "Total", cell: (c) => <span className="font-mono font-medium tabular-nums">{moeda(c.getValue())}</span> }),
  ], [orcamentoId, editavel, links]);

  const tabela = useReactTable({
    data: dados, columns: colunas, state: { globalFilter: busca, expanded: expandido },
    onGlobalFilterChange: setBusca, onExpandedChange: setExpandido, getRowCanExpand: (r) => Boolean(r.original.memoria),
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getRowId: (r) => r.id,
  });

  const porEtapa = new Map<string, ReturnType<typeof tabela.getRowModel>["rows"]>();
  for (const r of tabela.getRowModel().rows) porEtapa.set(r.original.etapa, [...(porEtapa.get(r.original.etapa) ?? []), r]);
  const numericas = new Set(["quantidade", "custoUnitario", "precoUnitario", "total"]);
  const nCols = colunas.length;

  return (
    <div className="space-y-3">
      <div className="nao-imprimir flex flex-wrap items-center gap-2">
        <Input aria-label="Buscar na planilha" placeholder="Buscar serviço, código ou ambiente…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-72" />
        <Select aria-label="Filtrar por ambiente" value={ambiente} onChange={(e) => setAmbiente(e.target.value)} className="w-56">
          <option value="">Todos os ambientes</option>
          <option value="_geral">Itens gerais da obra</option>
          {ambientes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </Select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-acento" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} /> Só itens com alerta
        </label>
        <span className="ml-auto text-xs text-suave">{tabela.getRowModel().rows.length} de {linhas.length} itens</span>
      </div>
      <div className="w-full overflow-x-auto rounded-lg border border-borda">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-fundo">
            {tabela.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th key={h.id} className={cn("border-b border-borda px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-suave", numericas.has(h.column.id) && "text-right")}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {[...porEtapa.entries()].map(([etapa, rows]) => (
              <Fragment key={etapa}>
                <tr className="bg-acento/5">
                  <td colSpan={nCols - 1} className="px-3 py-2 font-semibold">{rows[0]!.original.nomeEtapa}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{moeda(totaisEtapa[etapa])}</td>
                </tr>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className={cn("border-t border-borda/70", r.original.alerta && "bg-aviso/5")}>
                      {r.getVisibleCells().map((c) => (
                        <td key={c.id} className={cn("px-3 py-2 align-top", numericas.has(c.column.id) && "text-right")}>
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      ))}
                    </tr>
                    {r.getIsExpanded() ? (
                      <tr><td colSpan={nCols} className="bg-fundo px-3 py-2 font-mono text-xs text-suave">
                        {r.original.memoria}
                        {r.original.quantidadeCalculada && r.original.editado ? ` · calculado: ${numero(r.original.quantidadeCalculada, 4)}` : ""}
                      </td></tr>
                    ) : null}
                  </Fragment>
                ))}
              </Fragment>
            ))}
            {porEtapa.size === 0 ? <tr><td colSpan={nCols} className="px-3 py-6 text-center text-suave">Nenhum item com esses filtros.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
