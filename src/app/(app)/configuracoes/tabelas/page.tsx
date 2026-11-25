import type { Metadata } from "next";
import { EditorTabela } from "@/components/configuracoes/editor-tabela";
import {
  CHAVES_TABELA, formatarTabela, INFO_TABELA, tabelasEfetivas, type LinhaTabelaBanco,
} from "@/components/configuracoes/tabelas-esquemas";
import { Alerta, Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { contextoPagina } from "../contexto";

export const metadata: Metadata = { title: "Tabelas paramétricas" };

export default async function PaginaTabelas() {
  const { supabase, atual, editor } = await contextoPagina();
  const { data, error } = await supabase.from("tabelas_parametricas").select("empresa_id, chave, config")
    .or(`empresa_id.is.null,empresa_id.eq.${atual.id}`);
  const linhas = (data ?? []) as LinhaTabelaBanco[];
  const efetivas = tabelasEfetivas(linhas);

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alerta tom="perigo">Não foi possível carregar as tabelas: {error.message}</Alerta> : null}
      <Alerta tom="info">
        Cada tabela é editada em JSON e validada antes de salvar. O valor exibido já combina o padrão do sistema com
        a semente global e as alterações da empresa; ao salvar, a tabela inteira passa a valer para a empresa.
        {!editor ? " Seu acesso é somente leitura." : ""}
      </Alerta>
      {CHAVES_TABELA.map((chave) => {
        const personalizada = linhas.some((l) => l.chave === chave && l.empresa_id === atual.id);
        const json = formatarTabela(efetivas[chave]);
        return (
          <Card key={chave}>
            <CardHeader
              titulo={INFO_TABELA[chave].titulo}
              descricao={INFO_TABELA[chave].ajuda}
              acoes={personalizada ? <Badge tom="info">Personalizada pela empresa</Badge> : <Badge>Global</Badge>}
            />
            <CardBody>
              {editor ? (
                <EditorTabela chave={chave} json={json} personalizada={personalizada} />
              ) : (
                <pre className="overflow-x-auto rounded-md bg-fundo p-3 font-mono text-xs text-tinta">{json}</pre>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
