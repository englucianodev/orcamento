import Link from "next/link";
import { Badge, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { dec, soma } from "@/lib/engine/decimal";
import { exigirEmpresa, podeEditar } from "@/lib/empresa";
import { mesAno, moeda, numero } from "@/lib/utils";
import { BotaoExcluir, FormularioNovoOrcamento } from "./formularios";

export const metadata = { title: "Orçamentos · ORÇAOBRA" };

const LIMITE_LISTA = 200;

interface LinhaPainel {
  id: string;
  nome: string;
  cliente: string | null;
  uf: string | null;
  mes_base: string | null;
  status: "rascunho" | "revisao" | "aprovado";
  versao: number;
  total: string | null;
  area_construida: string | null;
  etapa_assistente: number;
  atualizado_em: string;
}

const STATUS = {
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
  revisao: { rotulo: "Em revisão", tom: "aviso" },
  aprovado: { rotulo: "Aprovado", tom: "sucesso" },
} as const;

export default async function Painel() {
  const { supabase, atual } = await exigirEmpresa();
  const { data, error } = await supabase.from("orcamentos")
    .select("id, nome, cliente, uf, mes_base, status, versao, total, area_construida, etapa_assistente, atualizado_em")
    .eq("empresa_id", atual.id).order("atualizado_em", { ascending: false }).limit(LIMITE_LISTA);
  if (error) throw new Error(`Falha ao listar orçamentos: ${error.message}`);
  const linhas = (data ?? []) as LinhaPainel[];
  const resumo = (["rascunho", "revisao", "aprovado"] as const).map((s) => {
    const doStatus = linhas.filter((l) => l.status === s);
    return { status: s, qtd: doStatus.length, total: soma(doStatus.map((l) => dec(l.total))) };
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Orçamentos</h1>
          <p className="text-sm text-suave">
            {atual.nome} · {linhas.length >= LIMITE_LISTA ? `os ${LIMITE_LISTA} atualizados mais recentemente (resumo sobre eles)` : `${linhas.length} orçamento(s)`}
          </p>
        </div>
        {podeEditar(atual.papel) ? <FormularioNovoOrcamento /> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {resumo.map((r) => (
          <Card key={r.status}>
            <CardBody>
              <p className="text-xs text-suave">{STATUS[r.status].rotulo}</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{r.qtd}</p>
              <p className="text-xs text-suave">{moeda(r.total.toFixed(2))} em orçamentos</p>
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader titulo="Orçamentos da empresa" descricao="Rascunhos continuam de onde você parou no assistente." />
        <CardBody className="p-0">
          {linhas.length === 0 ? (
            <div className="p-5"><Vazio titulo="Nenhum orçamento ainda">Crie o primeiro com o nome da obra.</Vazio></div>
          ) : (
            <Tabela>
              <thead>
                <tr><Th>Obra</Th><Th>Cliente</Th><Th>UF · base</Th><Th>Status</Th><Th numerico>Área (m²)</Th><Th numerico>Total</Th><Th>Atualizado</Th><Th><span className="sr-only">Ações</span></Th></tr>
              </thead>
              <tbody>
                {linhas.map((o) => (
                  <tr key={o.id} className="border-t border-borda">
                    <Td>
                      <Link href={o.total !== null ? `/orcamentos/${o.id}` : `/orcamentos/${o.id}/assistente`} className="font-medium text-acento hover:underline">{o.nome}</Link>
                      {o.total === null ? <span className="ml-2 text-xs text-suave">passo {o.etapa_assistente}/10</span> : null}
                    </Td>
                    <Td>{o.cliente ?? "—"}</Td>
                    <Td>{o.uf ?? "—"} · {mesAno(o.mes_base)}</Td>
                    <Td><Badge tom={STATUS[o.status].tom}>{STATUS[o.status].rotulo} · v{o.versao}</Badge></Td>
                    <Td numerico>{numero(o.area_construida)}</Td>
                    <Td numerico>{moeda(o.total)}</Td>
                    <Td>{new Date(o.atualizado_em).toLocaleDateString("pt-BR")}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Link href={`/orcamentos/${o.id}/assistente`} className="rounded px-2 py-1 text-xs hover:bg-fundo">Assistente</Link>
                        {atual.papel === "admin" && o.status !== "aprovado" ? <BotaoExcluir id={o.id} nome={o.nome} /> : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
