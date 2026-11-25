/**
 * Relatórios em PDF (seção 11) a partir do modelo pronto. A4; paisagem para planilhas largas
 * (sintética, analítica, cronograma). Fontes Helvetica embutidas, sem rede.
 * Sem JSX (ver pdf-partes/base.tsx): o mesmo código roda no Next e no Vitest.
 */
import { Document, Page, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { Cabecalho, Rodape, est, h, type LogoPdf } from "./pdf-partes/base";
import { Analitica, Composicoes, Memoria, Sintetica } from "./pdf-partes/planilhas";
import { Abc, Bdi, Cronograma, Proposta, Resumo } from "./pdf-partes/quadros";
import type { ModeloRelatorio } from "./tipos";
import { TITULOS_RELATORIO, type TipoRelatorio } from "./tipos-relatorio";

export type { LogoPdf } from "./pdf-partes/base";

type Secao = Exclude<TipoRelatorio, "completo">;

const SECOES: Record<Secao, { paisagem: boolean; Componente: (p: { m: ModeloRelatorio }) => ReactElement }> = {
  proposta: { paisagem: false, Componente: Proposta },
  resumo: { paisagem: false, Componente: Resumo },
  sintetica: { paisagem: true, Componente: Sintetica },
  analitica: { paisagem: true, Componente: Analitica },
  memoria: { paisagem: false, Componente: Memoria },
  composicoes: { paisagem: false, Componente: Composicoes },
  bdi: { paisagem: false, Componente: Bdi },
  abc: { paisagem: false, Componente: Abc },
  cronograma: { paisagem: true, Componente: Cronograma },
};

const ORDEM_COMPLETO: readonly Secao[] = ["proposta", "resumo", "sintetica", "analitica", "memoria", "composicoes", "bdi", "abc", "cronograma"];

export function secoesDoTipo(tipo: TipoRelatorio): readonly Secao[] {
  return tipo === "completo" ? ORDEM_COMPLETO : [tipo];
}

export interface PropsDocumento {
  modelo: ModeloRelatorio;
  tipo: TipoRelatorio;
  logo?: LogoPdf | null;
}

export function documentoRelatorio({ modelo, tipo, logo }: PropsDocumento): ReactElement<DocumentProps> {
  const c = modelo.cabecalho;
  const paginas = secoesDoTipo(tipo).map((s) => {
    const { paisagem, Componente } = SECOES[s];
    return h(Page, { key: s, size: "A4", orientation: paisagem ? "landscape" : "portrait", style: est.pagina, wrap: true },
      h(Cabecalho, { c, titulo: TITULOS_RELATORIO[s], logo }),
      h(Componente, { m: modelo }),
      h(Rodape, { c }),
    );
  });
  return h(Document, {
    title: `${TITULOS_RELATORIO[tipo]} — ${c.obra}`, author: c.empresa.nome, creator: "ORÇAOBRA", producer: "ORÇAOBRA", language: "pt-BR",
  }, ...paginas);
}

/** Gera o PDF do relatório em memória. */
export async function gerarPdf(modelo: ModeloRelatorio, tipo: TipoRelatorio, logo?: LogoPdf | null): Promise<Buffer> {
  return renderToBuffer(documentoRelatorio({ modelo, tipo, logo }));
}

/** Detecta PNG/JPEG pelos bytes iniciais; outros formatos (SVG, WebP) não são suportados no PDF. */
export function logoParaPdf(bytes: Uint8Array): LogoPdf | null {
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!png && !jpg) return null;
  return { data: Buffer.from(bytes), format: png ? "png" : "jpg" };
}
