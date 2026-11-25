/**
 * Lista de relatórios do orçamento (seção 11) com links de PDF e Excel. Componente de servidor
 * (sem estado): os arquivos são gerados por /api/relatorios/<id>/pdf|xlsx?tipo=...
 */
import { FileSpreadsheet, FileText } from "lucide-react";
import { Alerta, Card, CardBody, CardHeader } from "@/components/ui/card";
import { estiloBotao } from "@/components/ui/button";
import { TITULOS_RELATORIO, TIPOS_RELATORIO, type TipoRelatorio } from "@/lib/relatorios/tipos-relatorio";

const DESCRICOES: Record<TipoRelatorio, string> = {
  proposta: "Documento para o cliente com logo, valor por etapa, valor global e assinatura.",
  sintetica: "Itens por etapa com Fonte/Código, quantidades, preços com BDI e subtotais.",
  analitica: "Cada item aberto em insumos e composições auxiliares.",
  memoria: "Quantitativos e memória de cálculo agrupados por ambiente.",
  composicoes: "Composições SINAPI/SICRO usadas, com coeficientes e preços.",
  bdi: "Componentes do BDI (TCU), faixas de referência e encargos sociais.",
  abc: "Itens ordenados por valor, classes A, B e C.",
  cronograma: "Desembolso mensal por etapa, acumulado e percentual.",
  resumo: "Total por etapa, custo por m² e comparação com o CUB.",
  completo: "Todos os relatórios em um único arquivo.",
};

/** A proposta é um documento (só PDF); os demais têm aba equivalente no Excel. */
const SEM_EXCEL: ReadonlySet<TipoRelatorio> = new Set(["proposta"]);

export interface LinksRelatoriosProps {
  orcamentoId: string;
  /** quantidade de itens sem composição (os relatórios saem, mas marcam esses itens) */
  semComposicao: number;
}

export function LinksRelatorios({ orcamentoId, semComposicao }: LinksRelatoriosProps) {
  const base = `/api/relatorios/${encodeURIComponent(orcamentoId)}`;
  return (
    <Card>
      <CardHeader titulo="Relatórios" descricao="Gere os documentos do orçamento em PDF ou Excel." />
      <CardBody className="space-y-4">
        {semComposicao > 0 ? (
          <Alerta tom="aviso" titulo={`${semComposicao} ${semComposicao === 1 ? "item está" : "itens estão"} sem composição`}>
            Os relatórios são gerados mesmo assim, mas esses itens aparecem marcados e ficam fora do total.
            Mapeie as composições na planilha para fechar o orçamento.
          </Alerta>
        ) : null}
        <ul className="divide-y divide-borda">
          {TIPOS_RELATORIO.map((tipo) => (
            <li key={tipo} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-tinta">{TITULOS_RELATORIO[tipo]}</p>
                <p className="text-xs text-suave">{DESCRICOES[tipo]}</p>
              </div>
              <div className="flex gap-2">
                <a href={`${base}/pdf?tipo=${tipo}`} className={estiloBotao({ variant: "secundario", size: "sm" })} download>
                  <FileText aria-hidden className="h-4 w-4 text-acento" /> PDF
                </a>
                {SEM_EXCEL.has(tipo) ? null : (
                  <a href={`${base}/xlsx?tipo=${tipo}`} className={estiloBotao({ variant: "secundario", size: "sm" })} download>
                    <FileSpreadsheet aria-hidden className="h-4 w-4 text-sucesso" /> Excel
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
