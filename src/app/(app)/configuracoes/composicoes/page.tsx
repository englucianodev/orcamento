import type { Metadata } from "next";
import Link from "next/link";
import { br } from "@/components/configuracoes/decimais";
import {
  BotaoExcluirComposicao, FormularioComposicao, type ComposicaoPropria,
} from "@/components/configuracoes/formulario-composicao";
import { estiloBotao } from "@/components/ui/button";
import { Alerta, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { contextoPagina } from "../contexto";

export const metadata: Metadata = { title: "Composições próprias" };

export default async function PaginaComposicoes({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const { supabase, atual, editor } = await contextoPagina();
  const { data, error } = await supabase.from("composicoes")
    .select("id, codigo, descricao, unidade, preco_publicado::text")
    .eq("empresa_id", atual.id).is("base_id", null).order("codigo");
  const lista = (data ?? []) as unknown as ComposicaoPropria[];
  const emEdicao = editar ? lista.find((c) => String(c.id) === editar) ?? null : null;

  return (
    <div className="flex flex-col gap-5">
      <Alerta tom="info" titulo="Composições próprias (fonte PRÓPRIA)">
        Use para serviços que não existem nas bases oficiais. O custo unitário é informado pela empresa e
        <strong> não tem analítico oficial</strong> (insumos e coeficientes). Depois de criar, ligue o serviço do catálogo a ela em Configurações → Mapeamento com a fonte “Própria”.
      </Alerta>
      {error ? <Alerta tom="perigo">Não foi possível carregar as composições: {error.message}</Alerta> : null}

      {editor ? (
        <Card>
          <CardHeader titulo={emEdicao ? `Editar ${emEdicao.codigo}` : "Nova composição própria"} />
          <CardBody><FormularioComposicao atual={emEdicao} /></CardBody>
        </Card>
      ) : <Alerta tom="info">Seu acesso é somente leitura.</Alerta>}

      <Card>
        <CardHeader titulo="Composições da empresa" descricao={`${lista.length} cadastrada(s).`} />
        <CardBody>
          {lista.length ? (
            <Tabela>
              <thead>
                <tr><Th>Código</Th><Th>Descrição</Th><Th>Unidade</Th><Th numerico>Custo unitário (R$)</Th>{editor ? <Th className="w-1" /> : null}</tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} className={c.id === emEdicao?.id ? "bg-acento/5" : undefined}>
                    <Td className="font-mono">{c.codigo}</Td>
                    <Td>{c.descricao}</Td>
                    <Td>{c.unidade}</Td>
                    <Td numerico>{br(c.preco_publicado)}</Td>
                    {editor ? (
                      <Td className="whitespace-nowrap">
                        <div className="flex gap-1">
                          <Link href={`/configuracoes/composicoes?editar=${c.id}`} className={estiloBotao({ variant: "fantasma", size: "sm" })}>Editar</Link>
                          <BotaoExcluirComposicao id={c.id} codigo={c.codigo} />
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Tabela>
          ) : <Vazio titulo="Nenhuma composição própria">Crie a primeira acima.</Vazio>}
        </CardBody>
      </Card>
    </div>
  );
}
