import type { Metadata } from "next";
import Link from "next/link";
import { BotaoExcluirBdi } from "@/components/configuracoes/excluir-bdi";
import { fracaoParaPercentual, br } from "@/components/configuracoes/decimais";
import { COMPONENTES_BDI, type FormBdi } from "@/components/configuracoes/esquemas";
import { FormularioBdi } from "@/components/configuracoes/formulario-bdi";
import { rotuloOpcao } from "@/components/configuracoes/rotulos";
import { estiloBotao } from "@/components/ui/button";
import { Alerta, Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { verificarFaixasBdi } from "@/lib/engine/bdi";
import { faixasDoBanco, parametrosBdi, taxaBdi, type LinhaBdi, type LinhaFaixa } from "@/lib/orcamento/config";
import { contextoPagina } from "../contexto";

export const metadata: Metadata = { title: "BDI" };

type LinhaBdiEmpresa = LinhaBdi & { empresa_id: string | null };

const NOVO: FormBdi = { id: "", nome: "", tipo: "servico", tipo_obra: "edificacoes", ac: "", s: "", r: "", g: "", df: "", l: "", i: "" };

function paraFormulario(b: LinhaBdiEmpresa): FormBdi {
  const pct = Object.fromEntries(COMPONENTES_BDI.map((c) => [c, fracaoParaPercentual(b[c]).replace(".", ",")]));
  return { ...NOVO, ...pct, id: b.id, nome: b.nome, tipo: b.tipo, tipo_obra: b.tipo_obra as FormBdi["tipo_obra"] };
}

export default async function PaginaBdi({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const { supabase, atual, editor } = await contextoPagina();
  const [configs, faixasR] = await Promise.all([
    supabase.from("bdi_config")
      .select("id, empresa_id, nome, tipo, tipo_obra, ac::text, s::text, r::text, g::text, df::text, l::text, i::text")
      .or(`empresa_id.is.null,empresa_id.eq.${atual.id}`).order("nome"),
    supabase.from("bdi_faixas").select("tipo_obra, componente, minimo::text, medio::text, maximo::text"),
  ]);
  const lista = (configs.data ?? []) as unknown as LinhaBdiEmpresa[];
  const faixas = (faixasR.data ?? []) as unknown as LinhaFaixa[];
  const emEdicao = editar ? lista.find((b) => b.id === editar && b.empresa_id === atual.id) : undefined;
  const erro = configs.error ?? faixasR.error;

  return (
    <div className="flex flex-col gap-5">
      {erro ? <Alerta tom="perigo">Não foi possível carregar os BDIs: {erro.message}</Alerta> : null}
      <Card>
        <CardHeader titulo="BDIs disponíveis" descricao="Os globais são referência (somente leitura); a empresa cria os seus para usar nos orçamentos." />
        <CardBody>
          <Tabela>
            <thead>
              <tr>
                <Th>Nome</Th><Th>Aplicação</Th><Th>Tipo de obra</Th>
                {COMPONENTES_BDI.map((c) => <Th key={c} numerico>{c.toUpperCase()} %</Th>)}
                <Th numerico>BDI %</Th><Th>Faixas</Th>{editor ? <Th className="w-1" /> : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((b) => {
                const alertas = verificarFaixasBdi(parametrosBdi(b), faixasDoBanco(faixas, b.tipo_obra));
                const propria = b.empresa_id === atual.id;
                return (
                  <tr key={b.id} className={b.id === emEdicao?.id ? "bg-acento/5" : undefined}>
                    <Td>{b.nome} {propria ? null : <Badge>Global</Badge>}</Td>
                    <Td>{rotuloOpcao(b.tipo)}</Td>
                    <Td>{rotuloOpcao(b.tipo_obra)}</Td>
                    {COMPONENTES_BDI.map((c) => <Td key={c} numerico>{br(fracaoParaPercentual(b[c]))}</Td>)}
                    <Td numerico className="font-semibold">{br(fracaoParaPercentual(taxaBdi(b).toDecimalPlaces(6).toFixed()))}</Td>
                    <Td>
                      {alertas.length ? (
                        <Badge tom="aviso"><span title={alertas.map((a) => a.mensagem).join("\n")}>{alertas.length} alerta(s)</span></Badge>
                      ) : <Badge tom="sucesso">OK</Badge>}
                    </Td>
                    {editor ? (
                      <Td className="whitespace-nowrap">
                        {propria ? (
                          <div className="flex gap-1">
                            <Link href={`/configuracoes/bdi?editar=${b.id}`} className={estiloBotao({ variant: "fantasma", size: "sm" })}>Editar</Link>
                            <BotaoExcluirBdi id={b.id} nome={b.nome} />
                          </div>
                        ) : null}
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        </CardBody>
      </Card>

      {editor ? (
        <Card>
          <CardHeader
            titulo={emEdicao ? `Editar BDI: ${emEdicao.nome}` : "Novo BDI da empresa"}
            descricao="Informe os componentes em percentual. O BDI e os alertas das faixas de referência do TCU (Acórdão 2622/2013) são calculados ao vivo."
          />
          <CardBody>
            <FormularioBdi key={emEdicao?.id ?? "novo"} inicial={emEdicao ? paraFormulario(emEdicao) : NOVO} faixas={faixas} />
          </CardBody>
        </Card>
      ) : <Alerta tom="info">Seu acesso é somente leitura.</Alerta>}
    </div>
  );
}
