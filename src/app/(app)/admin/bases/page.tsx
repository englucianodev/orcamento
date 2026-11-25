import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { exigirAdminPlataforma } from "@/lib/empresa";
import { validacaoArmazenadaSchema } from "@/lib/importacao/validacao";
import { mesAno } from "@/lib/utils";
import { BotaoExcluirBase } from "./botao-excluir";
import { Importador } from "./importador";
import { ResumoValidacao } from "./relatorio";

export const metadata: Metadata = { title: "Admin · Bases" };

interface LinhaBase {
  id: string;
  fonte: "SINAPI" | "SICRO";
  uf: string;
  mes_ano: string;
  desonerado: boolean;
  layout: string | null;
  importado_em: string | null;
  validacao: unknown;
  avisos: unknown;
}

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function PaginaAdminBases() {
  const ctx = await exigirAdminPlataforma();
  const { data, error } = await ctx.supabase.from("bases_referencia")
    .select("id, fonte, uf, mes_ano, desonerado, layout, importado_em, validacao, avisos")
    .order("mes_ano", { ascending: false }).order("fonte").order("uf");
  const bases = (data ?? []) as LinhaBase[];

  return (
    <div className="flex flex-col gap-6">
      <Importador />
      <Card>
        <CardHeader
          titulo="Bases importadas"
          descricao="O plano gratuito do Supabase tem 500 MB: importe só as UFs usadas e exclua datas-base antigas."
        />
        <CardBody>
          {error ? <p className="text-sm text-perigo">Não foi possível carregar as bases.</p> : !bases.length ? (
            <Vazio titulo="Nenhuma base importada">Importe a primeira base SINAPI ou SICRO acima.</Vazio>
          ) : (
            <Tabela>
              <thead>
                <tr><Th>Fonte</Th><Th>UF</Th><Th>Mês</Th><Th>Desoneração</Th><Th>Layout</Th><Th>Importada em</Th><Th>Validação</Th><Th className="w-1" /></tr>
              </thead>
              <tbody>
                {bases.map((b) => {
                  const v = validacaoArmazenadaSchema.safeParse(b.validacao);
                  const avisos = Array.isArray(b.avisos) ? b.avisos.length : 0;
                  return (
                    <tr key={b.id}>
                      <Td className="font-medium">{b.fonte}</Td>
                      <Td>{b.uf}</Td>
                      <Td className="font-mono">{mesAno(b.mes_ano)}</Td>
                      <Td>{b.desonerado ? "Desonerado" : "Não desonerado"}</Td>
                      <Td className="font-mono text-xs text-suave">{b.layout ?? "—"}</Td>
                      <Td>
                        {b.importado_em ? DATA_HORA.format(new Date(b.importado_em)) : <Badge tom="aviso">Incompleta</Badge>}
                      </Td>
                      <Td>
                        {v.success ? <ResumoValidacao v={v.data} /> : <span className="text-suave">—</span>}
                        {avisos ? <p className="mt-1 text-xs text-suave">{avisos} aviso(s) na leitura</p> : null}
                      </Td>
                      <Td><BotaoExcluirBase id={b.id} rotulo={`${b.fonte} ${b.uf} ${mesAno(b.mes_ano)}`} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
