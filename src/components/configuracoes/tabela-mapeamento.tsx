import Link from "next/link";
import type { ReactNode } from "react";
import { estiloBotao } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { br } from "./decimais";
import { alertaUnidade, rotuloPadroes, type ResumoChave } from "./mapeamento-efetivo";
import { ROTULO_FONTE } from "./rotulos";
import type { InfoComposicao, ItemCatalogo } from "./tipos-mapeamento";

export interface LinhaTabelaMapeamento {
  item: ItemCatalogo;
  resumo: ResumoChave;
}

interface Props {
  linhas: readonly LinhaTabelaMapeamento[];
  composicoes: Readonly<Record<string, InfoComposicao>>;
  empresaId: string;
  /** chave aberta no editor e o conteúdo do editor */
  aberta: string | null;
  editor: ReactNode;
  urlEditar: ((chave: string) => string) | null;
}

const SITUACAO = {
  mapeado: <Badge tom="sucesso">Mapeado</Badge>,
  parcial: <Badge tom="aviso">Parcial</Badge>,
  nao_mapeado: <Badge tom="perigo">Sem composição</Badge>,
} as const;

function Efetivo({ linha, composicoes, empresaId }: { linha: LinhaTabelaMapeamento; composicoes: Props["composicoes"]; empresaId: string }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {linha.resumo.grupos.map((g) => {
        const m = g.linha;
        const prefixo = linha.resumo.grupos.length > 1 ? <span className="text-xs text-suave">{rotuloPadroes(g.padroes)}: </span> : null;
        if (!m) return <li key={g.padroes.join()}>{prefixo}<span className="text-perigo">sem composição</span></li>;
        const info = composicoes[`${m.fonte}|${m.codigo}`];
        const alerta = alertaUnidade(linha.item.unidade, info?.unidade, m.fatorConversao);
        return (
          <li key={g.padroes.join()} className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5">
              {prefixo}
              <Badge>{ROTULO_FONTE[m.fonte]}</Badge>
              <span className="font-mono">{m.codigo}</span>
              <Badge tom={m.empresaId === empresaId ? "info" : "neutro"}>{m.empresaId ? "empresa" : "global"}</Badge>
            </span>
            <span className="text-xs text-suave">
              {info ? info.descricao : "Composição não encontrada na base de referência."}
              {" · "}{linha.item.unidade} → {info?.unidade ?? "?"} · fator {br(m.fatorConversao)}
            </span>
            {alerta ? <span className="text-xs text-aviso">{alerta}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Tabela das chaves de uma etapa com o mapeamento efetivo e o editor inline da chave aberta. */
export function TabelaMapeamento({ linhas, composicoes, empresaId, aberta, editor, urlEditar }: Props) {
  return (
    <Tabela>
      <thead>
        <tr><Th className="w-2/5">Serviço</Th><Th>Un.</Th><Th>Composição efetiva</Th><Th>Situação</Th>{urlEditar ? <Th className="w-1" /> : null}</tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <LinhaChave key={l.item.chave} linha={l} composicoes={composicoes} empresaId={empresaId} aberta={aberta === l.item.chave} editor={editor} urlEditar={urlEditar} />
        ))}
      </tbody>
    </Tabela>
  );
}

function LinhaChave({ linha, composicoes, empresaId, aberta, editor, urlEditar }: Omit<Props, "linhas" | "aberta"> & { linha: LinhaTabelaMapeamento; aberta: boolean }) {
  return (
    <>
      <tr id={`chave-${linha.item.chave}`} className={aberta ? "bg-acento/5" : undefined}>
        <Td>
          <p className="text-tinta">{linha.item.descricao}</p>
          <p className="font-mono text-xs text-suave">{linha.item.chave}</p>
        </Td>
        <Td className="whitespace-nowrap">{linha.item.unidade}</Td>
        <Td><Efetivo linha={linha} composicoes={composicoes} empresaId={empresaId} /></Td>
        <Td>{SITUACAO[linha.resumo.situacao]}</Td>
        {urlEditar ? (
          <Td>
            <Link href={urlEditar(linha.item.chave)} scroll={false} className={estiloBotao({ variant: "secundario", size: "sm" })}>
              {linha.resumo.situacao === "nao_mapeado" ? "Mapear" : "Editar"}
            </Link>
          </Td>
        ) : null}
      </tr>
      {aberta && editor ? (
        <tr><td colSpan={urlEditar ? 5 : 4} className="border-b border-borda p-3">{editor}</td></tr>
      ) : null}
    </>
  );
}
