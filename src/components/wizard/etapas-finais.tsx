"use client";
/** Passos 8 (revisão dos quantitativos com memória), 9 (BDI, DMT e geração) e 10 (resultado). */
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { previaQuantitativos, type EstadoGeracao, type Previa } from "@/app/(app)/orcamentos/acoes";
import { estiloBotao } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { moeda, numero } from "@/lib/utils";
import { CampoNumero, CampoOpcoes, Grade, Secao } from "./campos";
import type { ValoresAssistente } from "./valores";

export function EtapaRevisao({ orcamentoId }: { orcamentoId: string }) {
  const { getValues } = useFormContext<ValoresAssistente>();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [pendente, iniciar] = useTransition();
  const calcular = () => iniciar(async () => setPrevia(await previaQuantitativos(orcamentoId, getValues("entrada"))));
  // calcula ao entrar no passo
  useEffect(calcular, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (pendente || !previa) return <p className="text-sm text-suave" role="status">Calculando quantitativos…</p>;
  if (previa.erro) return <Alerta tom="perigo" titulo="Não foi possível calcular">{previa.erro}</Alerta>;
  const grupos = new Map<string, NonNullable<Previa["itens"]>>();
  for (const i of previa.itens ?? []) grupos.set(i.nomeEtapa, [...(grupos.get(i.nomeEtapa) ?? []), i]);
  return (
    <div className="space-y-4">
      <Alerta tom="info" titulo={`Área construída: ${numero(previa.areaConstruida)} m² · ${previa.itens?.length ?? 0} serviços`}>
        <ul className="list-disc pl-5">{previa.memorias?.map((m) => <li key={m} className="font-mono text-xs">{m}</li>)}</ul>
      </Alerta>
      <p className="text-sm text-suave">Confira as quantidades. Depois de gerar, você pode editar qualquer quantidade na planilha (fica marcada como editada).</p>
      {[...grupos.entries()].map(([etapa, itens]) => (
        <section key={etapa} className="rounded-md border border-borda">
          <h3 className="border-b border-borda bg-fundo px-3 py-2 text-sm font-semibold">{etapa}</h3>
          <Tabela>
            <thead><tr><Th>Serviço</Th><Th>Ambiente</Th><Th numerico>Quantidade</Th><Th>Un.</Th><Th>Memória de cálculo</Th></tr></thead>
            <tbody>
              {itens.map((i, k) => (
                <tr key={`${i.chave}-${k}`}>
                  <Td>{i.descricao}</Td>
                  <Td>{i.ambiente ?? "—"}</Td>
                  <Td numerico>{numero(i.quantidade, 2)}</Td>
                  <Td>{i.unidade}</Td>
                  <Td className="max-w-md font-mono text-xs text-suave">{i.memoria}</Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </section>
      ))}
      <button type="button" className={estiloBotao({ variant: "secundario", size: "sm" })} onClick={calcular}>Recalcular prévia</button>
    </div>
  );
}

export interface OpcaoBdi {
  id: string;
  nome: string;
  tipo: "servico" | "material";
  taxa: string;
  daEmpresa: boolean;
}

export function EtapaOrcamento({ bdis }: { bdis: OpcaoBdi[] }) {
  const { control } = useFormContext<ValoresAssistente>();
  const [servico, material] = useWatch({ control, name: ["meta.bdi_servico_id", "meta.bdi_material_id"] });
  const opcoes = (tipo: OpcaoBdi["tipo"]) =>
    bdis.filter((b) => b.tipo === tipo).map((b) => [b.id, `${b.nome} — ${numero(Number(b.taxa) * 100, 2)}%${b.daEmpresa ? "" : " (padrão)"}`] as const);
  return (
    <div className="space-y-5">
      <Secao titulo="BDI" descricao="Vazio = BDI da empresa (ou o padrão do sistema). Fórmula do TCU; edite as taxas em Configurações → BDI.">
        <Grade colunas={2}>
          <CampoOpcoes nome="meta.bdi_servico_id" rotulo="BDI de serviços" opcoes={opcoes("servico")} conversao="nulo" vazio="Automático" />
          <CampoOpcoes nome="meta.bdi_material_id" rotulo="BDI diferenciado de materiais/equipamentos" opcoes={opcoes("material")} conversao="nulo" vazio="Automático" />
        </Grade>
        {!servico || !material ? <p className="text-xs text-suave">Escolha automática: BDI da empresa do tipo correspondente; sem ele, o padrão global.</p> : null}
      </Secao>
      <Secao titulo="Distâncias de transporte (SICRO)" descricao="Momento de transporte dos serviços SICRO: leito natural, revestimento primário e pavimentado.">
        <Grade>
          <CampoNumero nome="meta.dmt.ln" rotulo="Leito natural" unidade="km" />
          <CampoNumero nome="meta.dmt.rp" rotulo="Revestimento primário" unidade="km" />
          <CampoNumero nome="meta.dmt.p" rotulo="Pavimentado" unidade="km" />
        </Grade>
      </Secao>
    </div>
  );
}

export function EtapaFinal({ orcamentoId, geracao }: { orcamentoId: string; geracao: EstadoGeracao | null }) {
  const r = geracao?.resumo;
  const base = `/orcamentos/${orcamentoId}`;
  return (
    <div className="space-y-4">
      {geracao?.erro ? <Alerta tom="perigo" titulo="Não foi possível gerar">{geracao.erro}</Alerta> : null}
      {r ? (
        <Alerta tom={r.semComposicao ? "aviso" : "sucesso"} titulo={`Orçamento gerado: ${moeda(r.total)} · ${r.itens} itens`}>
          {r.semComposicao ? <p>{r.semComposicao} item(ns) sem composição ou sem custo — mapeie em Configurações → Mapeamento antes de aprovar.</p> : null}
          <ul className="list-disc pl-5">{r.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alerta>
      ) : (
        <p className="text-sm text-suave">Gere o orçamento no passo anterior para ver a planilha, o cronograma e os relatórios.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href={base} className={estiloBotao({})}>Abrir planilha</Link>
        <Link href={`${base}?aba=cronograma`} className={estiloBotao({ variant: "secundario" })}>Cronograma físico-financeiro</Link>
        <Link href={`${base}?aba=relatorios`} className={estiloBotao({ variant: "secundario" })}>Relatórios PDF / Excel</Link>
      </div>
    </div>
  );
}
