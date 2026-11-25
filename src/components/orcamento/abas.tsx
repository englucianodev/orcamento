/** Abas do orçamento renderizadas no servidor: composições, curva ABC, cronograma e histórico. */
import Link from "next/link";
import { Alerta, Badge, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import type { ComposicaoUsada, CronogramaVisao, LinhaAbcVisao } from "@/lib/orcamento/visao";
import { mesAno, moeda, numero } from "@/lib/utils";

export function AbaComposicoes({ composicoes, links }: { composicoes: ComposicaoUsada[]; links: { SINAPI: string | null; SICRO: string | null } }) {
  if (composicoes.length === 0) return <Vazio titulo="Nenhuma composição usada">Gere o orçamento e mapeie os serviços em Configurações → Mapeamento.</Vazio>;
  const href = (c: ComposicaoUsada) => {
    if (c.fonte === "PROPRIA") return `/bases?fonte=PROPRIA&composicao=${encodeURIComponent(c.codigo)}`;
    const b = links[c.fonte as "SINAPI" | "SICRO"];
    return b ? `/bases?base=${b}&composicao=${encodeURIComponent(c.codigo)}` : null;
  };
  return (
    <Card>
      <CardHeader titulo="Composições usadas" descricao="Clique no código para ver a composição analítica (insumos, coeficientes e preços da base)." />
      <CardBody className="p-0">
        <Tabela>
          <thead><tr><Th>Fonte</Th><Th>Código</Th><Th>Descrição</Th><Th>Un.</Th><Th numerico>Custo unit.</Th><Th numerico>Itens</Th><Th numerico>Total c/ BDI</Th></tr></thead>
          <tbody>
            {composicoes.map((c) => {
              const h = href(c);
              return (
                <tr key={`${c.fonte}-${c.codigo}`}>
                  <Td><Badge tom={c.fonte === "PROPRIA" ? "info" : "neutro"}>{c.fonte}</Badge></Td>
                  <Td className="font-mono">{h ? <Link href={h} className="text-acento hover:underline">{c.codigo}</Link> : c.codigo}</Td>
                  <Td>{c.descricao}</Td><Td>{c.unidade}</Td>
                  <Td numerico>{numero(c.custoUnitario, 4)}</Td><Td numerico>{c.itens}</Td><Td numerico>{moeda(c.total)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </CardBody>
    </Card>
  );
}

const TOM_CLASSE = { A: "perigo", B: "aviso", C: "neutro" } as const;

export function AbaAbc({ linhas }: { linhas: LinhaAbcVisao[] }) {
  if (linhas.length === 0) return <Vazio titulo="Sem itens com valor">A curva ABC aparece depois que os itens têm custo.</Vazio>;
  const cont = { A: 0, B: 0, C: 0 };
  for (const l of linhas) cont[l.classe]++;
  return (
    <Card>
      <CardHeader titulo="Curva ABC dos serviços" descricao={`Classe A até 80% do valor, B até 95%, C o restante · A: ${cont.A} · B: ${cont.B} · C: ${cont.C} itens`} />
      <CardBody className="p-0">
        <Tabela>
          <thead><tr><Th>#</Th><Th>Classe</Th><Th>Serviço</Th><Th numerico>Total</Th><Th numerico>%</Th><Th numerico>% acumulado</Th></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.id}>
                <Td className="font-mono text-xs">{i + 1}</Td><Td><Badge tom={TOM_CLASSE[l.classe]}>{l.classe}</Badge></Td><Td>{l.descricao}</Td>
                <Td numerico>{moeda(l.total)}</Td><Td numerico>{numero(l.percentual)}</Td><Td numerico>{numero(l.acumulado)}</Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </CardBody>
    </Card>
  );
}

/** Curva S (acumulado %) em SVG simples, sem biblioteca. */
function CurvaS({ pontos }: { pontos: string[] }) {
  const L = 640, A = 200, m = 32;
  const n = pontos.length;
  if (n === 0) return null;
  const x = (i: number) => m + (n === 1 ? (L - 2 * m) / 2 : (i * (L - 2 * m)) / (n - 1));
  const y = (p: number) => A - m / 2 - (p / 100) * (A - m);
  const d = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number(p)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Curva S do desembolso acumulado" className="h-auto w-full max-w-3xl">
      {[0, 50, 100].map((p) => (
        <g key={p}>
          <line x1={m} x2={L - m} y1={y(p)} y2={y(p)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={4} y={y(p) + 4} fontSize={10} fill="currentColor" fillOpacity={0.6}>{p}%</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} />
      {pontos.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(Number(p))} r={3} fill="currentColor" />
          <text x={x(i)} y={A - 2} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

export function AbaCronograma({ c, memoriaPrazo }: { c: CronogramaVisao; memoriaPrazo?: string }) {
  if (c.meses === 0) return <Vazio titulo="Cronograma ainda não gerado">Gere ou recalcule o orçamento.</Vazio>;
  const meses = Array.from({ length: c.meses }, (_, i) => i);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader titulo="Curva S" descricao={memoriaPrazo ?? `${c.meses} meses · total ${moeda(c.total)}`} />
        <CardBody className="text-acento"><CurvaS pontos={c.percentualAcumulado} /></CardBody>
      </Card>
      <Card>
        <CardHeader titulo="Cronograma físico-financeiro" descricao="Valor mensal por etapa (R$); a distribuição usa a curva típica das etapas (Configurações → Tabelas)." />
        <CardBody className="p-0">
          <Tabela>
            <thead><tr><Th>Etapa</Th>{meses.map((m) => <Th key={m} numerico>Mês {m + 1}</Th>)}<Th numerico>Total</Th></tr></thead>
            <tbody>
              {c.linhas.map((l) => (
                <tr key={l.etapa}>
                  <Td className="whitespace-nowrap">{l.nome}</Td>
                  {l.valores.map((v, m) => <Td key={m} numerico className={Number(v) === 0 ? "text-suave/50" : undefined}>{Number(v) === 0 ? "—" : numero(v)}</Td>)}
                  <Td numerico className="font-medium">{numero(l.total)}</Td>
                </tr>
              ))}
              <tr className="bg-fundo font-medium"><Td>Total do mês</Td>{c.totaisMes.map((v, m) => <Td key={m} numerico>{numero(v)}</Td>)}<Td numerico>{numero(c.total)}</Td></tr>
              <tr><Td>Acumulado</Td>{c.acumulado.map((v, m) => <Td key={m} numerico>{numero(v)}</Td>)}<Td /></tr>
              <tr><Td>% acumulado</Td>{c.percentualAcumulado.map((v, m) => <Td key={m} numerico>{numero(v)}%</Td>)}<Td /></tr>
            </tbody>
          </Tabela>
        </CardBody>
      </Card>
    </div>
  );
}

export interface VersaoLinha { versao: number; status: string; total: string | null; motivo: string | null; criado_em: string; snapshot: { orcamento?: { mes_base?: string | null; desonerado?: boolean | null } } }

export function AbaHistorico({ versoes, versaoAtual, children }: { versoes: VersaoLinha[]; versaoAtual: number; children?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader titulo="Versões aprovadas" descricao={`Versão atual: ${versaoAtual}. Cada aprovação grava uma cópia imutável do orçamento.`} />
        <CardBody className="p-0">
          {versoes.length === 0 ? <div className="p-5"><Alerta tom="info">Nenhuma versão aprovada ainda.</Alerta></div> : (
            <Tabela>
              <thead><tr><Th>Versão</Th><Th>Data</Th><Th>Base</Th><Th numerico>Total</Th><Th>Observação</Th></tr></thead>
              <tbody>
                {versoes.map((v) => (
                  <tr key={v.versao}>
                    <Td className="font-mono">v{v.versao}</Td>
                    <Td>{new Date(v.criado_em).toLocaleString("pt-BR")}</Td>
                    <Td>{mesAno(v.snapshot.orcamento?.mes_base)} · {v.snapshot.orcamento?.desonerado ? "desonerado" : "não desonerado"}</Td>
                    <Td numerico>{moeda(v.total)}</Td>
                    <Td>{v.motivo ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </CardBody>
      </Card>
      {children}
    </div>
  );
}
