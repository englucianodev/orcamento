"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alerta, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/form";
import { Tabela, Td, Th } from "@/components/ui/table";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { cn, mensagemDeErro, mesAno, moeda } from "@/lib/utils";
import { AnaliticaComposicao } from "./analitica";
import {
  LIMITE_INSUMOS, buscarComposicoes, buscarInsumos, type BaseOpcao, type ComposicaoEncontrada, type InsumoEncontrado,
} from "./dados";

type Aba = "composicoes" | "insumos";
type Resultado = { aba: "composicoes"; linhas: ComposicaoEncontrada[] } | { aba: "insumos"; linhas: InsumoEncontrado[] };

interface Props {
  bases: BaseOpcao[];
  baseInicial: string | null;
  composicaoInicial: string | null;
}

const rotuloBase = (b: BaseOpcao) => `${b.fonte} ${b.uf} ${mesAno(b.mes_ano)} · ${b.desonerado ? "desonerado" : "não desonerado"}`;

/** Mantém a URL compartilhável (?base=&composicao=) sem recarregar a página. */
function atualizarUrl(baseId: string, codigo: string | null) {
  const params = new URLSearchParams({ base: baseId });
  if (codigo) params.set("composicao", codigo);
  window.history.replaceState(null, "", `/bases?${params.toString()}`);
}

export function ConsultaBases({ bases, baseInicial, composicaoInicial }: Props) {
  const [baseId, setBaseId] = useState(baseInicial ?? bases[0]?.id ?? "");
  const [aba, setAba] = useState<Aba>("composicoes");
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(baseInicial ? composicaoInicial : null);
  const base = bases.find((b) => b.id === baseId) ?? null;

  function trocarBase(id: string) {
    setBaseId(id); setResultado(null); setAberta(null); setErro(null);
    atualizarUrl(id, null);
  }

  function abrir(codigo: string | null) {
    setAberta(codigo);
    if (baseId) atualizarUrl(baseId, codigo);
  }

  async function buscar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!base) return;
    setErro(null); setBuscando(true);
    try {
      const supabase = criarClienteNavegador();
      setResultado(aba === "composicoes"
        ? { aba, linhas: await buscarComposicoes(supabase, base.id, termo) }
        : { aba, linhas: await buscarInsumos(supabase, base.id, termo) });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setResultado(null);
    } finally {
      setBuscando(false);
    }
  }

  if (!bases.length) {
    return <Vazio titulo="Nenhuma base importada">Peça ao administrador da plataforma para importar o SINAPI ou o SICRO da sua UF.</Vazio>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader titulo="Bases de referência" descricao="Consulte insumos e composições SINAPI/SICRO por UF e data-base." />
        <CardBody className="flex flex-col gap-4">
          <Campo rotulo="Base" htmlFor="base" className="max-w-md">
            <Select id="base" value={baseId} onChange={(e) => trocarBase(e.target.value)}>
              {bases.map((b) => <option key={b.id} value={b.id}>{rotuloBase(b)}</option>)}
            </Select>
          </Campo>
          <div className="flex gap-1" role="tablist" aria-label="Tipo de consulta">
            {(["composicoes", "insumos"] as const).map((a) => (
              <button
                key={a} type="button" role="tab" aria-selected={aba === a}
                onClick={() => { setAba(a); setResultado(null); setErro(null); }}
                className={cn("rounded px-3 py-1.5 text-sm", aba === a ? "bg-acento text-white" : "text-suave hover:bg-fundo")}
              >
                {a === "composicoes" ? "Composições" : "Insumos"}
              </button>
            ))}
          </div>
          <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
            <Campo rotulo={aba === "composicoes" ? "Código ou descrição da composição" : "Código ou descrição do insumo"} htmlFor="termo" className="min-w-64 flex-1">
              <Input id="termo" value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={100} placeholder={aba === "composicoes" ? "ex.: alvenaria bloco cerâmico" : "ex.: cimento"} />
            </Campo>
            <Button type="submit" disabled={buscando || !base}>{buscando ? "Buscando…" : "Buscar"}</Button>
          </form>
          {erro ? <Alerta tom="perigo">{erro}</Alerta> : null}
          <Resultados resultado={resultado} aoAbrir={abrir} />
        </CardBody>
      </Card>
      {base && aberta ? <AnaliticaComposicao key={`${base.id}-${aberta}`} base={base} codigo={aberta} aoAbrir={abrir} aoFechar={() => abrir(null)} /> : null}
    </div>
  );
}

function Resultados({ resultado, aoAbrir }: { resultado: Resultado | null; aoAbrir: (codigo: string) => void }) {
  if (!resultado) return null;
  if (!resultado.linhas.length) return <p className="text-sm text-suave">Nada encontrado.</p>;
  if (resultado.aba === "composicoes") {
    return (
      <Tabela>
        <thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th numerico>Preço publicado</Th></tr></thead>
        <tbody>
          {resultado.linhas.map((c) => (
            <tr key={c.codigo} className="cursor-pointer hover:bg-fundo" onClick={() => aoAbrir(c.codigo)}>
              <Td className="font-mono"><button type="button" className="text-acento underline">{c.codigo}</button></Td>
              <Td>{c.descricao ?? "—"}</Td>
              <Td>{c.unidade ?? ""}</Td>
              <Td numerico>{moeda(c.preco_publicado)}</Td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Tabela>
        <thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th>Tipo</Th><Th numerico>Preço</Th><Th>Origem</Th></tr></thead>
        <tbody>
          {resultado.linhas.map((i) => (
            <tr key={i.codigo}>
              <Td className="font-mono">{i.codigo}</Td>
              <Td>{i.descricao ?? "—"}</Td>
              <Td>{i.unidade ?? ""}</Td>
              <Td className="text-xs text-suave">{i.tipo ?? ""}</Td>
              <Td numerico>{moeda(i.preco)}</Td>
              <Td className="text-xs text-suave">{i.origem_preco ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </Tabela>
      {resultado.linhas.length >= LIMITE_INSUMOS ? <p className="text-xs text-suave">Mostrando os {LIMITE_INSUMOS} primeiros. Refine a busca.</p> : null}
    </div>
  );
}
