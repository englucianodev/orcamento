import Link from "next/link";
import { notFound } from "next/navigation";
import { AbaBdi } from "@/components/orcamento/aba-bdi";
import { AbaAbc, AbaComposicoes, AbaCronograma, AbaHistorico, type VersaoLinha } from "@/components/orcamento/abas";
import { AcoesOrcamento } from "@/components/orcamento/acoes-orcamento";
import { FormularioReprecificar } from "@/components/orcamento/formularios";
import { Planilha } from "@/components/planilha/planilha";
import { LinksRelatorios } from "@/components/relatorios/links-relatorios";
import { Alerta, Badge, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { exigirEmpresa, podeEditar } from "@/lib/empresa";
import { carregarOrcamento, type DadosOrcamento } from "@/lib/orcamento/carregar";
import { abcDoOrcamento, composicoesUsadas, cronogramaVisao, linhasPlanilha } from "@/lib/orcamento/visao";
import { cn, mesAno, moeda, numero } from "@/lib/utils";

export const metadata = { title: "Orçamento · ORÇAOBRA" };

const ABAS = [
  ["planilha", "Planilha"], ["composicoes", "Composições"], ["bdi", "BDI e encargos"], ["abc", "Curva ABC"],
  ["cronograma", "Cronograma"], ["relatorios", "Relatórios"], ["historico", "Histórico"],
] as const;
type Aba = (typeof ABAS)[number][0];
const STATUS = { rascunho: ["Rascunho", "neutro"], revisao: ["Em revisão", "aviso"], aprovado: ["Aprovado", "sucesso"] } as const;

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="min-w-36">
      <p className="text-xs text-suave">{rotulo}</p>
      <p className="font-mono text-lg font-semibold tabular-nums">{valor}</p>
      {detalhe ? <p className="text-xs text-suave">{detalhe}</p> : null}
    </div>
  );
}

export default async function PaginaOrcamento({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }>;
}) {
  const [{ id }, { aba: abaBruta }] = await Promise.all([params, searchParams]);
  const aba: Aba = ABAS.some(([a]) => a === abaBruta) ? (abaBruta as Aba) : "planilha";
  const { supabase, empresas } = await exigirEmpresa();
  const dados = await carregarOrcamento(supabase, id);
  if (!dados) notFound();
  const { orcamento: o, resultado: r } = dados;
  const papel = empresas.find((e) => e.id === o.empresa_id)?.papel;
  const editavel = Boolean(papel && podeEditar(papel));

  const ambientes = new Map((o.entrada?.ambientes ?? []).map((a) => [a.id, a.nome]));
  const linhas = linhasPlanilha(dados.itens, r, ambientes);
  const totaisEtapa = Object.fromEntries(r.totaisEtapa.map((t) => [t.etapa, t.total.toFixed(2)]));
  const links = { SINAPI: dados.bases.sinapi?.id ?? null, SICRO: dados.bases.sicro?.id ?? null };
  const semComposicao = r.semComposicao.length;
  const [rotStatus, tomStatus] = STATUS[o.status];
  const cub = r.diferencaCub;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs text-suave"><Link href="/painel" className="hover:underline">Orçamentos</Link> / {o.nome}</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{o.nome}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-suave">
              <Badge tom={tomStatus}>{rotStatus} · v{o.versao}</Badge>
              {o.cliente ? <span>{o.cliente}</span> : null}
              <span>{o.uf ?? "—"} · SINAPI {mesAno(o.mes_base)}{o.mes_base_sicro ? ` · SICRO ${mesAno(o.mes_base_sicro)}` : ""} · {o.desonerado ? "desonerado" : "não desonerado"}</span>
            </p>
          </div>
          <AcoesOrcamento orcamentoId={o.id} status={o.status} editavel={editavel} aprovavel={r.aprovavel && dados.itens.length > 0} />
        </div>
        <Card>
          <CardBody className="flex flex-wrap gap-x-10 gap-y-3">
            <Indicador rotulo="Total com BDI" valor={moeda(r.total.toFixed(2))} />
            <Indicador rotulo="Custo direto" valor={moeda(r.custoDireto.toFixed(2))} />
            <Indicador rotulo="Área construída" valor={`${numero(o.area_construida)} m²`} />
            <Indicador rotulo="Custo por m²" valor={moeda(r.custoM2?.toFixed(2) ?? null)}
              detalhe={cub ? `${cub.gte(0) ? "+" : ""}${numero(cub.times(100).toNumber(), 1)}% em relação ao CUB (${moeda(o.cub_m2)})` : o.cub_m2 ? undefined : "informe o CUB no assistente para comparar"} />
            <Indicador rotulo="Itens" valor={String(dados.itens.length)} detalhe={semComposicao ? `${semComposicao} sem composição/custo` : "todos com custo"} />
          </CardBody>
        </Card>
        {semComposicao > 0 ? (
          <Alerta tom="aviso" titulo={`${semComposicao} item(ns) sem composição ou sem custo — a aprovação fica bloqueada.`}>
            Mapeie os serviços em <Link href="/configuracoes/mapeamento" className="underline">Configurações → Mapeamento</Link> e recalcule. Use o filtro “Só itens com alerta” na planilha.
          </Alerta>
        ) : null}
        {dados.bases.avisos.map((a) => <Alerta key={a} tom="aviso">{a}</Alerta>)}
      </div>

      <nav aria-label="Abas do orçamento" className="nao-imprimir flex flex-wrap gap-1 border-b border-borda">
        {ABAS.map(([k, rot]) => (
          <Link key={k} href={k === "planilha" ? `/orcamentos/${id}` : `/orcamentos/${id}?aba=${k}`} aria-current={aba === k ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", aba === k ? "border-acento font-medium text-acento" : "border-transparent text-suave hover:text-tinta")}>
            {rot}
          </Link>
        ))}
      </nav>

      {aba === "planilha" ? (
        dados.itens.length === 0
          ? <Vazio titulo="O orçamento ainda não foi gerado"><Link href={`/orcamentos/${id}/assistente`} className="text-acento underline">Abra o assistente</Link> e gere no passo 9.</Vazio>
          : <Planilha orcamentoId={id} linhas={linhas} totaisEtapa={totaisEtapa} editavel={editavel && o.status !== "aprovado"} links={links} />
      ) : null}
      {aba === "composicoes" ? <AbaComposicoes composicoes={composicoesUsadas(linhas)} links={links} /> : null}
      {aba === "bdi" ? <AbaBdi supabase={supabase} dados={dados} editavel={editavel} /> : null}
      {aba === "abc" ? <AbaAbc linhas={abcDoOrcamento(linhas)} /> : null}
      {aba === "cronograma" ? <AbaCronograma c={cronogramaVisao(dados.cronograma, r.totaisEtapa)} /> : null}
      {aba === "relatorios" ? <LinksRelatorios orcamentoId={id} semComposicao={semComposicao} /> : null}
      {aba === "historico" ? <Historico id={id} dados={dados} editavel={editavel} /> : null}
    </div>
  );
}

async function Historico({ id, dados, editavel }: { id: string; dados: DadosOrcamento; editavel: boolean }) {
  const { supabase } = await exigirEmpresa();
  const o = dados.orcamento;
  const [versoesR, basesR] = await Promise.all([
    supabase.from("orcamento_versoes").select("versao, status, total, motivo, criado_em, snapshot").eq("orcamento_id", id).order("versao", { ascending: false }),
    o.uf
      ? supabase.from("bases_referencia").select("fonte, mes_ano, desonerado").eq("uf", o.uf).not("importado_em", "is", null).order("mes_ano", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (versoesR.error) throw new Error(versoesR.error.message);
  if (basesR.error) throw new Error(basesR.error.message);
  const bases = (basesR.data ?? []) as Array<{ fonte: string; mes_ano: string; desonerado: boolean }>;
  const unicos = (fonte: string) => [...new Set(bases.filter((b) => b.fonte === fonte).map((b) => b.mes_ano))];
  return (
    <AbaHistorico versoes={(versoesR.data ?? []) as VersaoLinha[]} versaoAtual={o.versao}>
      <Card>
        <CardHeader titulo="Reprecificar para outra data-base" descricao="Recalcula os custos com outra base importada, mantendo quantidades e edições manuais. Orçamentos aprovados precisam ser reabertos antes." />
        <CardBody>
          <FormularioReprecificar orcamentoId={id} meses={unicos("SINAPI")} mesesSicro={unicos("SICRO")}
            atual={{ mes_base: o.mes_base, mes_base_sicro: o.mes_base_sicro, desonerado: Boolean(o.desonerado) }}
            desabilitado={!editavel || o.status === "aprovado"} />
        </CardBody>
      </Card>
    </AbaHistorico>
  );
}
