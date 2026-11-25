import type { Metadata } from "next";
import { br } from "@/components/configuracoes/decimais";
import { EdicaoIndice } from "@/components/configuracoes/linha-indice";
import { Alerta, Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { INDICES_PADRAO } from "@/lib/engine/indices";
import { contextoPagina } from "../contexto";

export const metadata: Metadata = { title: "Índices paramétricos" };

interface LinhaIndice { empresa_id: string | null; chave: string; valor: string }

export default async function PaginaIndices() {
  const { supabase, atual, editor } = await contextoPagina();
  const { data, error } = await supabase.from("indices_parametricos")
    .select("empresa_id, chave, valor::text")
    .or(`empresa_id.is.null,empresa_id.eq.${atual.id}`);
  const linhas = (data ?? []) as unknown as LinhaIndice[];
  const globais = new Map(linhas.filter((l) => l.empresa_id === null).map((l) => [l.chave, l.valor]));
  const daEmpresa = new Map(linhas.filter((l) => l.empresa_id === atual.id).map((l) => [l.chave, l.valor]));

  return (
    <Card>
      <CardHeader
        titulo="Índices paramétricos"
        descricao={`Fatores usados pelo motor de quantitativos. O valor da empresa substitui o global. ${daEmpresa.size} de ${INDICES_PADRAO.length} personalizados.`}
      />
      <CardBody className="flex flex-col gap-4">
        {error ? <Alerta tom="perigo">Não foi possível carregar os índices: {error.message}</Alerta> : null}
        {!editor ? <Alerta tom="info">Seu acesso é somente leitura.</Alerta> : null}
        <Tabela>
          <thead>
            <tr>
              <Th>Índice</Th><Th>Unidade</Th><Th numerico>Global</Th><Th>{editor ? "Valor da empresa" : "Empresa"}</Th><Th>Origem</Th>
            </tr>
          </thead>
          <tbody>
            {INDICES_PADRAO.map((d) => {
              const global = globais.get(d.chave) ?? d.valor;
              const empresa = daEmpresa.get(d.chave) ?? null;
              return (
                <tr key={d.chave}>
                  <Td>
                    <p className="text-tinta">{d.descricao}</p>
                    <p className="font-mono text-xs text-suave">{d.chave}</p>
                  </Td>
                  <Td className="whitespace-nowrap">{d.unidade}</Td>
                  <Td numerico>{br(global)}</Td>
                  <Td>
                    {editor ? (
                      <EdicaoIndice chave={d.chave} valorEmpresa={empresa} valorGlobal={global} />
                    ) : empresa !== null ? <span className="font-mono">{br(empresa)}</span> : <span className="text-suave">—</span>}
                  </Td>
                  <Td>
                    {empresa !== null ? <Badge tom="info">empresa</Badge> : <Badge>{d.origem}</Badge>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </CardBody>
    </Card>
  );
}
