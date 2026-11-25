"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { excluirMapeamento, salvarMapeamento } from "@/app/(app)/configuracoes/mapeamento/acoes";
import { Button, estiloBotao } from "@/components/ui/button";
import { Alerta, Badge } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/form";
import { PADROES } from "@/lib/engine/entrada.schema";
import { br, paraCampo } from "./decimais";
import { FONTES, mapeamentoSchema, type Fonte } from "./esquemas";
import { BotaoConfirmar, MensagemEstado, useValidacaoCliente } from "./formulario";
import { ROTULO_FONTE, ROTULO_PADRAO } from "./rotulos";
import { SugestoesComposicao } from "./sugestoes-composicao";
import { ESTADO_INICIAL } from "./tipos";
import type { BaseOpcao, InfoComposicao, LinhaEmpresa } from "./tipos-mapeamento";

interface Props {
  chave: string;
  descricao: string;
  unidade: string;
  linhasEmpresa: readonly LinhaEmpresa[];
  bases: readonly BaseOpcao[];
  composicoes: Readonly<Record<string, InfoComposicao>>;
  urlFechar: string;
}

interface Campos { id: string; fonte: Fonte; padrao: string; codigo: string; fator: string; base: string }

const fontePadrao = (chave: string): Fonte => (chave.includes("SICRO") ? "SICRO" : "SINAPI");
const primeiraBase = (bases: readonly BaseOpcao[], fonte: Fonte): string => bases.find((b) => b.fonte === fonte)?.id ?? "";

function LinhaExistente({ linha, info, onEditar }: { linha: LinhaEmpresa; info: InfoComposicao | undefined; onEditar: () => void }) {
  const [estado, acao, enviando] = useActionState(excluirMapeamento, ESTADO_INICIAL);
  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-borda/60 py-2 text-sm last:border-0">
      <Badge tom="info">{linha.padrao ? ROTULO_PADRAO[linha.padrao] : "Todos os padrões"}</Badge>
      <Badge>{ROTULO_FONTE[linha.fonte]}</Badge>
      <span className="font-mono">{linha.codigo}</span>
      <span className="text-suave">{info?.descricao ?? ""}</span>
      <span className="text-xs text-suave">fator {br(linha.fatorConversao)}</span>
      <span className="ml-auto flex gap-1">
        <Button size="sm" variant="fantasma" onClick={onEditar}>Editar</Button>
        <form action={acao}>
          <input type="hidden" name="id" value={linha.id} />
          <BotaoConfirmar mensagem="Excluir este mapeamento da empresa? Passa a valer o global, se houver." size="sm" variant="fantasma" disabled={enviando}>
            Excluir
          </BotaoConfirmar>
        </form>
      </span>
      {estado.erro ? <p className="w-full text-xs text-perigo" role="alert">{estado.erro}</p> : null}
    </li>
  );
}

/** Edição do mapeamento chave → fonte + código da empresa, com sugestões e conferência do código. */
export function EditorMapeamento({ chave, descricao, unidade, linhasEmpresa, bases, composicoes, urlFechar }: Props) {
  const novo = (): Campos => {
    const fonte = fontePadrao(chave);
    return { id: "", fonte, padrao: "", codigo: "", fator: "1", base: primeiraBase(bases, fonte) };
  };
  const [campos, setCampos] = useState<Campos>(novo);
  const [estado, acao, salvando] = useActionState(salvarMapeamento, ESTADO_INICIAL);
  const { erroCliente, aoEnviar } = useValidacaoCliente(mapeamentoSchema);
  const alterar = (parcial: Partial<Campos>) => setCampos((c) => ({ ...c, ...parcial }));
  const trocarFonte = (fonte: Fonte) => alterar({ fonte, base: fonte === "PROPRIA" ? "" : primeiraBase(bases, fonte) });
  const basesDaFonte = bases.filter((b) => b.fonte === campos.fonte);
  const baseBusca = campos.fonte === "PROPRIA" ? "PROPRIA" : campos.base || null;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-acento/40 bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-tinta">{descricao}</p>
          <p className="text-xs text-suave"><span className="font-mono">{chave}</span> · unidade do catálogo: {unidade}</p>
        </div>
        <Link href={urlFechar} scroll={false} className={estiloBotao({ variant: "fantasma", size: "sm" })}>Fechar</Link>
      </div>

      {linhasEmpresa.length ? (
        <div>
          <p className="text-xs font-medium text-suave">Mapeamentos da empresa para este serviço</p>
          <ul>
            {linhasEmpresa.map((l) => (
              <LinhaExistente
                key={l.id}
                linha={l}
                info={composicoes[`${l.fonte}|${l.codigo}`]}
                onEditar={() => setCampos({ id: l.id, fonte: l.fonte, padrao: l.padrao ?? "", codigo: l.codigo, fator: paraCampo(l.fatorConversao), base: l.fonte === "PROPRIA" ? "" : primeiraBase(bases, l.fonte) })}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {!bases.length ? (
        <Alerta tom="aviso">Nenhuma base SINAPI/SICRO importada ainda. Até lá, só é possível mapear para composições próprias.</Alerta>
      ) : null}

      <form action={acao} onSubmit={aoEnviar} className="flex flex-col gap-3">
        <p className="text-sm font-medium text-tinta">{campos.id ? "Editar mapeamento" : "Novo mapeamento da empresa"}</p>
        <MensagemEstado estado={estado} erroCliente={erroCliente} />
        <input type="hidden" name="id" value={campos.id} />
        <input type="hidden" name="chave" value={chave} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Campo rotulo="Fonte" htmlFor="map-fonte">
            <Select id="map-fonte" name="fonte" value={campos.fonte} onChange={(e) => trocarFonte(e.target.value as Fonte)}>
              {FONTES.map((f) => <option key={f} value={f}>{ROTULO_FONTE[f]}</option>)}
            </Select>
          </Campo>
          <Campo rotulo="Padrão" htmlFor="map-padrao" ajuda="Vazio = vale para todos">
            <Select id="map-padrao" name="padrao" value={campos.padrao} onChange={(e) => alterar({ padrao: e.target.value })}>
              <option value="">Todos os padrões</option>
              {PADROES.map((p) => <option key={p} value={p}>{ROTULO_PADRAO[p]}</option>)}
            </Select>
          </Campo>
          {campos.fonte !== "PROPRIA" ? (
            <Campo rotulo="Base para conferir o código" htmlFor="map-base" className="lg:col-span-1">
              <Select id="map-base" name="base" value={campos.base} onChange={(e) => alterar({ base: e.target.value })}>
                {!basesDaFonte.length ? <option value="">Nenhuma base {campos.fonte} importada</option> : null}
                {basesDaFonte.map((b) => <option key={b.id} value={b.id}>{b.rotulo}</option>)}
              </Select>
            </Campo>
          ) : <input type="hidden" name="base" value="" />}
          <Campo rotulo="Código da composição" htmlFor="map-codigo">
            <Input id="map-codigo" name="codigo" value={campos.codigo} onChange={(e) => alterar({ codigo: e.target.value })} className="font-mono" required />
          </Campo>
          <Campo rotulo="Fator de conversão" htmlFor="map-fator" ajuda="Maior que zero">
            <Input id="map-fator" name="fator" value={campos.fator} onChange={(e) => alterar({ fator: e.target.value })} inputMode="decimal" className="text-right font-mono" required />
          </Campo>
        </div>
        <p className="text-xs text-suave">
          <strong>Quantidade do motor × fator = quantidade na unidade da composição.</strong> Ex.: serviço em m² e
          composição em m³ com 5 cm de espessura → fator 0,05. Se as unidades forem iguais, use 1.
          Precedência: empresa + padrão, empresa, global + padrão, global; no mesmo nível, Própria antes de SINAPI e
          SICRO (serviços SICRO: SICRO primeiro).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={salvando}>{salvando ? "Conferindo…" : "Salvar mapeamento"}</Button>
          {campos.id ? <Button variant="secundario" onClick={() => setCampos(novo())}>Novo em vez de editar</Button> : null}
        </div>
      </form>

      <SugestoesComposicao
        key={baseBusca ?? "sem-base"}
        base={baseBusca}
        termoInicial={descricao}
        onEscolher={(s) => alterar({ codigo: s.codigo })}
      />
    </div>
  );
}
