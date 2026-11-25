/** Componentes de exibição (sem estado) do importador: relatório de validação, avisos e progresso. */
import { Alerta, Badge } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import type { ValidacaoArmazenada } from "@/lib/importacao/validacao";
import { cn, moeda, numero } from "@/lib/utils";

export function ResumoValidacao({ v }: { v: ValidacaoArmazenada }) {
  const conferem = v.comparadas - v.totalDivergentes;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tom="sucesso">{numero(conferem, 0)} conferem</Badge>
      <Badge tom={v.totalDivergentes ? "aviso" : "neutro"}>{numero(v.totalDivergentes, 0)} divergentes</Badge>
      {v.totalSemCusto ? <Badge tom="perigo">{numero(v.totalSemCusto, 0)} sem custo</Badge> : null}
      {v.semPublicado ? <Badge>{numero(v.semPublicado, 0)} sem preço publicado</Badge> : null}
    </div>
  );
}

export function RelatorioValidacao({ v }: { v: ValidacaoArmazenada }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-suave">
        Cada composição com preço publicado foi recalculada pelo motor. Comparadas: {numero(v.comparadas, 0)}.
        Divergência = diferença acima de R$ 0,01.
      </p>
      <ResumoValidacao v={v} />
      {v.divergentes.length ? (
        <Tabela>
          <thead>
            <tr><Th>Composição</Th><Th numerico>Publicado</Th><Th numerico>Calculado</Th><Th numerico>Diferença</Th></tr>
          </thead>
          <tbody>
            {v.divergentes.map((d) => (
              <tr key={d.codigo}>
                <Td className="font-mono">{d.codigo}</Td>
                <Td numerico>{moeda(d.publicado)}</Td>
                <Td numerico>{moeda(d.calculado)}</Td>
                <Td numerico className={cn(Number(d.diferenca) > 0 ? "text-aviso" : "text-perigo")}>{moeda(d.diferenca)}</Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      ) : null}
      {v.totalDivergentes > v.divergentes.length ? (
        <p className="text-xs text-suave">Mostrando {v.divergentes.length} de {v.totalDivergentes} divergências.</p>
      ) : null}
      {v.semCusto.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-suave">Composições que o motor não conseguiu calcular ({v.totalSemCusto})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {v.semCusto.map((s) => (
              <li key={s.codigo}><span className="font-mono">{s.codigo}</span> <span className="text-suave">— {s.motivo}</span></li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function ListaAvisos({ avisos }: { avisos: readonly string[] }) {
  if (!avisos.length) return null;
  return (
    <Alerta tom="aviso" titulo="Avisos da leitura">
      <ul className="list-disc pl-4">{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </Alerta>
  );
}

export function CabecalhosEncontrados({ cabecalhos }: { cabecalhos: readonly string[][] }) {
  if (!cabecalhos.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-suave">Primeiras linhas encontradas na planilha (para identificar o novo layout):</p>
      <div className="max-h-72 overflow-auto rounded border border-borda">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {cabecalhos.map((linha, i) => (
              <tr key={i}>{linha.map((c, j) => <td key={j} className="border-b border-borda/60 px-2 py-1">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface ItemProgresso {
  rotulo: string;
  feitos: number;
  total: number;
  ativo: boolean;
}

export function BarrasProgresso({ itens }: { itens: readonly ItemProgresso[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {itens.map((it) => {
        const pct = it.total ? Math.round((it.feitos / it.total) * 100) : 0;
        const concluido = it.total > 0 && it.feitos >= it.total;
        return (
          <li key={it.rotulo} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className={cn(it.ativo ? "font-medium text-tinta" : "text-suave")}>{it.rotulo}</span>
              <span className="font-mono text-suave">{concluido ? "concluído" : `${it.feitos}/${it.total}`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-fundo" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={it.rotulo}>
              <div className={cn("h-full transition-all", concluido ? "bg-sucesso" : "bg-acento")} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
