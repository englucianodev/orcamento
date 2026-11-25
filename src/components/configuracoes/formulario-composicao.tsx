"use client";
import Link from "next/link";
import { useActionState } from "react";
import { excluirComposicao, salvarComposicao } from "@/app/(app)/configuracoes/composicoes/acoes";
import { Button, estiloBotao } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/form";
import { paraCampo } from "./decimais";
import { composicaoPropriaSchema } from "./esquemas";
import { BotaoConfirmar, MensagemEstado, useValidacaoCliente } from "./formulario";
import { ESTADO_INICIAL } from "./tipos";

export interface ComposicaoPropria {
  id: number;
  codigo: string;
  descricao: string | null;
  unidade: string | null;
  preco_publicado: string | null;
}

/** Criação/edição de composição própria (custo unitário informado, sem analítico oficial). */
export function FormularioComposicao({ atual }: { atual: ComposicaoPropria | null }) {
  const [estado, acao, enviando] = useActionState(salvarComposicao, ESTADO_INICIAL);
  const { erroCliente, aoEnviar } = useValidacaoCliente(composicaoPropriaSchema);
  return (
    <form key={atual?.id ?? `novo-${estado.ok ?? ""}`} action={acao} onSubmit={aoEnviar} className="flex flex-col gap-3">
      <MensagemEstado estado={estado} erroCliente={erroCliente} />
      <input type="hidden" name="id" value={atual?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_6rem_10rem]">
        <Campo rotulo="Código" htmlFor="comp-codigo" ajuda="Ex.: PROP-001">
          <Input id="comp-codigo" name="codigo" defaultValue={atual?.codigo ?? ""} required maxLength={40} className="font-mono" />
        </Campo>
        <Campo rotulo="Descrição" htmlFor="comp-descricao">
          <Input id="comp-descricao" name="descricao" defaultValue={atual?.descricao ?? ""} required maxLength={400} />
        </Campo>
        <Campo rotulo="Unidade" htmlFor="comp-unidade">
          <Input id="comp-unidade" name="unidade" defaultValue={atual?.unidade ?? ""} required maxLength={12} />
        </Campo>
        <Campo rotulo="Custo unitário (R$)" htmlFor="comp-preco" ajuda="Até 4 casas decimais">
          <Input id="comp-preco" name="preco" defaultValue={paraCampo(atual?.preco_publicado)} inputMode="decimal" required className="text-right font-mono" />
        </Campo>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>{atual ? "Salvar alterações" : "Criar composição"}</Button>
        {atual ? <Link href="/configuracoes/composicoes" className={estiloBotao({ variant: "secundario" })}>Cancelar edição</Link> : null}
      </div>
      {atual ? (
        <p className="text-xs text-suave">Se mudar o código, atualize também o mapeamento que usa o código antigo.</p>
      ) : null}
    </form>
  );
}

export function BotaoExcluirComposicao({ id, codigo }: { id: number; codigo: string }) {
  const [estado, acao, enviando] = useActionState(excluirComposicao, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col items-start">
      <input type="hidden" name="id" value={id} />
      <BotaoConfirmar
        mensagem={`Excluir a composição ${codigo}? Itens mapeados para ela ficarão "sem composição" até você remapear.`}
        variant="fantasma"
        size="sm"
        disabled={enviando}
      >
        Excluir
      </BotaoConfirmar>
      {estado.erro ? <p className="max-w-48 text-xs text-perigo" role="alert">{estado.erro}</p> : null}
    </form>
  );
}
