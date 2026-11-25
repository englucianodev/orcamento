import type { Metadata } from "next";
import Link from "next/link";
import { CopiarPadrao } from "@/components/configuracoes/copiar-padrao";
import { EditorMapeamento } from "@/components/configuracoes/editor-mapeamento";
import { resumirMapeamento } from "@/components/configuracoes/mapeamento-efetivo";
import { TabelaMapeamento, type LinhaTabelaMapeamento } from "@/components/configuracoes/tabela-mapeamento";
import type { LinhaEmpresa } from "@/components/configuracoes/tipos-mapeamento";
import { Button } from "@/components/ui/button";
import { Alerta, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { Checkbox, Select } from "@/components/ui/form";
import { ETAPAS } from "@/lib/engine/catalogo";
import { cn } from "@/lib/utils";
import { contextoPagina } from "../contexto";
import { carregarMapeamento } from "./dados";

export const metadata: Metadata = { title: "Mapeamento de serviços" };

interface Parametros { filtro?: string; chave?: string; sinapi?: string; sicro?: string }

function montarUrl(p: Parametros, mudancas: Partial<Parametros>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...p, ...mudancas })) if (v) q.set(k, v);
  const s = q.toString();
  return `/configuracoes/mapeamento${s ? `?${s}` : ""}`;
}

export default async function PaginaMapeamento({ searchParams }: { searchParams: Promise<Parametros> }) {
  const p = await searchParams;
  const { supabase, atual, editor } = await contextoPagina();
  const dados = await carregarMapeamento(supabase, atual.id, { sinapi: p.sinapi, sicro: p.sicro });
  const pendentes = p.filtro === "pendentes";

  const linhas: LinhaTabelaMapeamento[] = dados.catalogo.map((item) => ({ item, resumo: resumirMapeamento(item.chave, dados.mapeamentos) }));
  const mapeadas = linhas.filter((l) => l.resumo.situacao === "mapeado").length;
  const visiveis = pendentes ? linhas.filter((l) => l.resumo.situacao !== "mapeado" || l.item.chave === p.chave) : linhas;
  const aberta = editor && p.chave ? dados.catalogo.find((c) => c.chave === p.chave) ?? null : null;

  const linhasEmpresa: LinhaEmpresa[] = aberta
    ? dados.mapeamentos.filter((m) => m.chave === aberta.chave && m.empresaId === atual.id)
      .map((m) => ({ id: m.id, padrao: m.padrao, fonte: m.fonte, codigo: m.codigo, fatorConversao: m.fatorConversao }))
    : [];
  const painel = aberta ? (
    <EditorMapeamento
      key={aberta.chave}
      chave={aberta.chave}
      descricao={aberta.descricao}
      unidade={aberta.unidade}
      linhasEmpresa={linhasEmpresa}
      bases={dados.bases}
      composicoes={dados.composicoes}
      urlFechar={montarUrl(p, { chave: undefined })}
    />
  ) : null;
  const urlEditar = editor ? (chave: string) => montarUrl(p, { chave }) : null;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          titulo="Mapeamento serviço → composição"
          descricao={`${mapeadas} de ${linhas.length} serviços do catálogo mapeados em todos os padrões. Serviço sem composição entra na planilha com custo zero e alerta, e o orçamento não pode ser aprovado.`}
        />
        <CardBody className="flex flex-col gap-4">
          {dados.erros.map((e) => <Alerta key={e} tom="perigo">{e}</Alerta>)}
          <Alerta tom="info">
            Os códigos SINAPI/SICRO não vêm prontos: cada empresa escolhe a composição de cada serviço, com ajuda da busca
            nas bases importadas. Linhas globais são somente leitura; a linha da empresa tem precedência.
            {!editor ? " Seu acesso é somente leitura." : ""}
          </Alerta>
          <form method="get" className="flex flex-wrap items-end gap-3">
            {p.chave ? <input type="hidden" name="chave" value={p.chave} /> : null}
            <Checkbox name="filtro" value="pendentes" defaultChecked={pendentes} label="Só não mapeados" className="pb-2" />
            <label className="flex flex-col gap-1 text-xs text-suave">
              Base SINAPI para descrições
              <Select name="sinapi" defaultValue={dados.referencia.SINAPI?.id ?? ""} className="w-72">
                {dados.bases.filter((b) => b.fonte === "SINAPI").map((b) => <option key={b.id} value={b.id}>{b.rotulo}</option>)}
                {!dados.referencia.SINAPI ? <option value="">Nenhuma importada</option> : null}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-suave">
              Base SICRO para descrições
              <Select name="sicro" defaultValue={dados.referencia.SICRO?.id ?? ""} className="w-72">
                {dados.bases.filter((b) => b.fonte === "SICRO").map((b) => <option key={b.id} value={b.id}>{b.rotulo}</option>)}
                {!dados.referencia.SICRO ? <option value="">Nenhuma importada</option> : null}
              </Select>
            </label>
            <Button type="submit" variant="secundario">Aplicar</Button>
          </form>
        </CardBody>
      </Card>

      {editor ? (
        <Card>
          <CardHeader titulo="Copiar entre padrões" descricao="Replica os mapeamentos específicos da empresa de um padrão de acabamento para outro." />
          <CardBody><CopiarPadrao /></CardBody>
        </Card>
      ) : null}

      {!dados.catalogo.length && !dados.erros.length ? <Vazio titulo="Catálogo de serviços vazio">Rode o seed do banco.</Vazio> : null}

      <nav aria-label="Etapas" className="flex flex-wrap gap-1 text-xs">
        {ETAPAS.map((e) => <a key={e.id} href={`#etapa-${e.id}`} className="rounded border border-borda px-2 py-0.5 text-suave hover:text-tinta">{e.nome}</a>)}
      </nav>

      {ETAPAS.map((etapa) => {
        const daEtapa = visiveis.filter((l) => l.item.etapa === etapa.id);
        if (!daEtapa.length) return null;
        const total = linhas.filter((l) => l.item.etapa === etapa.id);
        const ok = total.filter((l) => l.resumo.situacao === "mapeado").length;
        return (
          <Card key={etapa.id} id={`etapa-${etapa.id}`}>
            <CardHeader
              titulo={etapa.nome}
              acoes={<span className={cn("text-sm", ok === total.length ? "text-sucesso" : "text-suave")}>{ok} de {total.length} mapeados</span>}
            />
            <CardBody className="p-0">
              <TabelaMapeamento
                linhas={daEtapa}
                composicoes={dados.composicoes}
                empresaId={atual.id}
                aberta={aberta?.chave ?? null}
                editor={painel}
                urlEditar={urlEditar}
              />
            </CardBody>
          </Card>
        );
      })}
      {pendentes && !visiveis.length && linhas.length ? <Alerta tom="sucesso">Todos os serviços estão mapeados.</Alerta> : null}
      <p className="text-xs text-suave">
        <Link href="/configuracoes/composicoes" className="underline">Composições próprias</Link> podem ser usadas com a fonte “Própria”.
      </p>
    </div>
  );
}
