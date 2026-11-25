"use client";
import { useEffect, useMemo, useState } from "react";
import { Alerta, Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabela, Td, Th } from "@/components/ui/table";
import { D, decOuNull, formatarBr, type Dec } from "@/lib/engine/decimal";
import { criarCalculadoraSinapi } from "@/lib/engine/precos-sinapi";
import { criarCalculadoraSicro, type DetalheSicro } from "@/lib/engine/precos-sicro";
import { baseSicroDoFechamento, baseSinapiDoFechamento, type Fechamento } from "@/lib/orcamento/fechamento";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { mensagemDeErro, numero } from "@/lib/utils";
import { carregarFechamento, type BaseOpcao } from "./dados";

interface Props {
  base: BaseOpcao;
  codigo: string;
  aoAbrir: (codigo: string) => void;
  aoFechar: () => void;
}

type Carga = { estado: "carregando" } | { estado: "erro"; mensagem: string } | { estado: "ok"; f: Fechamento };

const reais = (v: Dec | null | undefined) => (v ? `R$ ${formatarBr(v, 2)}` : "—");

function descricoes(f: Fechamento) {
  const comp = new Map(f.composicoes.map((c) => [c.codigo, c]));
  const ins = new Map(f.insumos.map((i) => [i.codigo, i]));
  return {
    comp, ins,
    de: (codigo: string) => comp.get(codigo) ?? ins.get(codigo) ?? null,
  };
}

function Comparacao({ publicado, calculado }: { publicado: Dec | null; calculado: Dec | null }) {
  const dif = publicado && calculado ? calculado.minus(publicado) : null;
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <span>Preço publicado: <strong className="font-mono">{reais(publicado)}</strong></span>
      <span>Custo recalculado: <strong className="font-mono">{reais(calculado)}</strong></span>
      {dif ? (
        dif.abs().gt(new D("0.01"))
          ? <Badge tom="aviso">diferença {formatarBr(dif, 2)}</Badge>
          : <Badge tom="sucesso">confere</Badge>
      ) : null}
    </div>
  );
}

function AnaliticaSinapi({ f, codigo, aoAbrir }: { f: Fechamento; codigo: string; aoAbrir: (c: string) => void }) {
  const { calc, linhas } = useMemo(() => {
    const c = criarCalculadoraSinapi(baseSinapiDoFechamento(f));
    return { calc: c, linhas: c.analitica(codigo) };
  }, [f, codigo]);
  const d = descricoes(f);
  const custo = calc.custo(codigo);
  const faltantes = custo ? [] : calc.faltantes(codigo);
  return (
    <div className="flex flex-col gap-3">
      <Comparacao publicado={decOuNull(d.comp.get(codigo)?.preco_publicado ?? null)} calculado={custo} />
      {faltantes.length ? <Alerta tom="aviso" titulo="Sem custo nesta base">{faltantes.slice(0, 5).join("; ")}</Alerta> : null}
      <Tabela>
        <thead>
          <tr><Th>Tipo</Th><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th numerico>Coeficiente</Th><Th numerico>Preço unit.</Th><Th numerico>Total</Th></tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const info = l.tipo === "COMPOSICAO" ? d.comp.get(l.codigo) : d.ins.get(l.codigo);
            return (
              <tr key={`${l.codigo}-${i}`}>
                <Td><Badge tom={l.tipo === "COMPOSICAO" ? "info" : "neutro"}>{l.tipo === "COMPOSICAO" ? "Composição" : "Insumo"}</Badge></Td>
                <Td className="font-mono">
                  {l.tipo === "COMPOSICAO"
                    ? <button type="button" className="text-acento underline" onClick={() => aoAbrir(l.codigo)}>{l.codigo}</button>
                    : l.codigo}
                </Td>
                <Td>{info?.descricao ?? "—"}</Td>
                <Td>{info?.unidade ?? ""}</Td>
                <Td numerico>{formatarBr(l.coeficiente, 7)}</Td>
                <Td numerico>{l.precoUnitario ? formatarBr(l.precoUnitario, 2) : "—"}</Td>
                <Td numerico>{l.total ? formatarBr(l.total, 2) : "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Tabela>
      <p className="text-xs text-suave">Regra SINAPI: o total de cada linha é truncado em 2 casas.</p>
    </div>
  );
}

const ROTULO_GRUPO: Record<string, string> = {
  A: "A · Equipamentos", B: "B · Mão de obra", C: "C · Materiais", D: "D · Atividades auxiliares",
  E: "E · Tempo fixo", F: "F · Momento de transporte",
};

const LINHAS_DETALHE: Array<[keyof DetalheSicro, string]> = [
  ["custoHorarioEquipamentos", "Custo horário de equipamentos"], ["custoHorarioMaoObra", "Custo horário de mão de obra"],
  ["custoExecucao", "Custo de execução (÷ produção)"], ["custoFic", "FIC"], ["custoMateriais", "Materiais"],
  ["custoAtividadesAuxiliares", "Atividades auxiliares"], ["custoTempoFixo", "Tempo fixo"],
  ["custoTransporte", "Transporte (DMT = 0 nesta consulta)"], ["custoUnitario", "Custo unitário"],
];

function AnaliticaSicro({ f, codigo, aoAbrir }: { f: Fechamento; codigo: string; aoAbrir: (c: string) => void }) {
  const calc = useMemo(() => criarCalculadoraSicro(baseSicroDoFechamento(f)), [f]);
  const d = descricoes(f);
  const detalhe = calc.detalhe(codigo);
  const comp = d.comp.get(codigo);
  const itens = f.itens.filter((i) => i.composicao_codigo === codigo);
  const preco = (grupo: string | null, cod: string): string => {
    const ins = d.ins.get(cod);
    if (grupo === "A") return ins?.chp ? `CHP ${numero(ins.chp, 4)} · CHI ${numero(ins.chi, 4)}` : "—";
    if (grupo === "B" || grupo === "C") return ins?.preco ? numero(ins.preco, 4) : "—";
    if (grupo === "D" || grupo === "E") return reais(calc.custo(cod));
    return "—";
  };
  return (
    <div className="flex flex-col gap-3">
      <Comparacao publicado={decOuNull(comp?.preco_publicado ?? null)} calculado={detalhe?.custoUnitario ?? null} />
      <p className="text-xs text-suave">Produção da equipe: {numero(comp?.producao_equipe ?? null, 4)} · FIC: {numero(comp?.fic ?? null, 5)}</p>
      {!detalhe ? <Alerta tom="aviso" titulo="Sem custo nesta base">{calc.faltantes(codigo).slice(0, 5).join("; ")}</Alerta> : (
        <Tabela>
          <tbody>
            {LINHAS_DETALHE.map(([chave, rotulo]) => (
              <tr key={chave}><Td>{rotulo}</Td><Td numerico className={chave === "custoUnitario" ? "font-semibold" : ""}>{formatarBr(detalhe[chave], 4)}</Td></tr>
            ))}
          </tbody>
        </Tabela>
      )}
      <Tabela>
        <thead>
          <tr><Th>Grupo</Th><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th numerico>Qtd./coef.</Th><Th numerico>Util. op./improd.</Th><Th numerico>Preço</Th></tr>
        </thead>
        <tbody>
          {itens.map((it, i) => {
            const info = d.de(it.item_codigo);
            const ehComp = it.grupo_sicro === "D" || it.grupo_sicro === "E";
            return (
              <tr key={`${it.item_codigo}-${i}`}>
                <Td className="whitespace-nowrap text-xs">{ROTULO_GRUPO[it.grupo_sicro ?? ""] ?? "—"}</Td>
                <Td className="font-mono">
                  {ehComp ? <button type="button" className="text-acento underline" onClick={() => aoAbrir(it.item_codigo)}>{it.item_codigo}</button> : it.item_codigo}
                </Td>
                <Td>
                  {info?.descricao ?? "—"}
                  {it.grupo_sicro === "F" && it.extra ? (
                    <span className="block text-xs text-suave">vias: {["ln", "rp", "p"].map((v) => it.extra?.[v] ? `${v.toUpperCase()} ${it.extra[v]}` : null).filter(Boolean).join(" · ") || "—"}</span>
                  ) : null}
                </Td>
                <Td>{info?.unidade ?? ""}</Td>
                <Td numerico>{numero(it.coeficiente, 5)}</Td>
                <Td numerico>{it.grupo_sicro === "A" ? `${numero(it.utilizacao_operativa, 2)} / ${numero(it.utilizacao_improdutiva, 2)}` : ""}</Td>
                <Td numerico className="whitespace-nowrap">{preco(it.grupo_sicro, it.item_codigo)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Tabela>
    </div>
  );
}

export function AnaliticaComposicao({ base, codigo, aoAbrir, aoFechar }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });

  useEffect(() => {
    let ativo = true;
    setCarga({ estado: "carregando" });
    carregarFechamento(criarClienteNavegador(), base.id, codigo)
      .then((f) => { if (ativo) setCarga({ estado: "ok", f }); })
      .catch((e: unknown) => { if (ativo) setCarga({ estado: "erro", mensagem: mensagemDeErro(e) }); });
    return () => { ativo = false; };
  }, [base.id, codigo]);

  const comp = carga.estado === "ok" ? carga.f.composicoes.find((c) => c.codigo === codigo) : undefined;
  return (
    <Card>
      <CardHeader
        titulo={<><span className="font-mono">{codigo}</span>{comp?.descricao ? ` — ${comp.descricao}` : ""}</>}
        descricao={comp ? `Unidade: ${comp.unidade ?? "—"}${comp.grupo ? ` · ${comp.grupo}` : ""}` : `${base.fonte} ${base.uf}`}
        acoes={<Button size="sm" variant="secundario" onClick={aoFechar}>Fechar</Button>}
      />
      <CardBody>
        {carga.estado === "carregando" ? <p className="text-sm text-suave">Carregando composição…</p> : null}
        {carga.estado === "erro" ? <Alerta tom="perigo">{carga.mensagem}</Alerta> : null}
        {carga.estado === "ok" && !comp ? <Alerta tom="aviso">Composição {codigo} não encontrada nesta base.</Alerta> : null}
        {carga.estado === "ok" && comp ? (
          base.fonte === "SINAPI"
            ? <AnaliticaSinapi f={carga.f} codigo={codigo} aoAbrir={aoAbrir} />
            : <AnaliticaSicro f={carga.f} codigo={codigo} aoAbrir={aoAbrir} />
        ) : null}
      </CardBody>
    </Card>
  );
}
