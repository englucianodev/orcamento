"use client";
import { useState, useTransition } from "react";
import { sugerirComposicoes } from "@/app/(app)/configuracoes/mapeamento/acoes";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Tabela, Td, Th } from "@/components/ui/table";
import { D } from "@/lib/engine/decimal";
import { br } from "./decimais";
import type { Sugestao } from "./tipos-mapeamento";

interface Props {
  /** id da base importada, ou "PROPRIA" para as composições da empresa; null = sem base */
  base: string | null;
  termoInicial: string;
  onEscolher: (s: Sugestao) => void;
}

/** Busca textual que sugere composições candidatas; o usuário confirma clicando em "Usar". */
export function SugestoesComposicao({ base, termoInicial, onEscolher }: Props) {
  const [termo, setTermo] = useState(termoInicial);
  const [itens, setItens] = useState<Sugestao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, iniciar] = useTransition();

  const buscar = () => {
    if (!base) {
      setErro("Escolha uma base para buscar.");
      return;
    }
    iniciar(async () => {
      const r = await sugerirComposicoes({ base, termo });
      setErro(r.erro ?? null);
      setItens(r.itens ?? null);
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-borda bg-fundo/50 p-3">
      <p className="text-xs font-medium text-suave">Sugestões (busca por semelhança e texto completo; confira antes de usar)</p>
      <div className="flex gap-2">
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          aria-label="Termo de busca de composições"
        />
        <Button variant="secundario" onClick={buscar} disabled={buscando || !base}>{buscando ? "Buscando…" : "Buscar"}</Button>
      </div>
      {erro ? <Alerta tom="perigo">{erro}</Alerta> : null}
      {itens && !itens.length ? <p className="text-sm text-suave">Nenhuma composição encontrada. Tente outras palavras ou o código.</p> : null}
      {itens?.length ? (
        <div className="max-h-80 overflow-y-auto">
          <Tabela>
            <thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Un.</Th><Th numerico>Preço</Th><Th className="w-1" /></tr></thead>
            <tbody>
              {itens.map((s) => (
                <tr key={s.codigo}>
                  <Td className="font-mono">{s.codigo}</Td>
                  <Td className="text-xs">{s.descricao}</Td>
                  <Td>{s.unidade}</Td>
                  <Td numerico>{s.preco ? br(new D(s.preco).toFixed(2)) : "—"}</Td>
                  <Td><Button size="sm" variant="secundario" onClick={() => onEscolher(s)}>Usar</Button></Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </div>
      ) : null}
    </div>
  );
}
