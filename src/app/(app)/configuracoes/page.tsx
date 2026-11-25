import type { Metadata } from "next";
import Link from "next/link";
import {
  contarMapeadas, paraMapeamentos, type LinhaMapeamentoBanco,
} from "@/components/configuracoes/mapeamento-efetivo";
import { SECOES_CONFIGURACAO } from "@/components/configuracoes/rotulos";
import { CHAVES_TABELA } from "@/components/configuracoes/tabelas-esquemas";
import { Alerta, Card, CardBody } from "@/components/ui/card";
import { INDICES_PADRAO } from "@/lib/engine/indices";
import { PADROES } from "@/lib/engine/entrada.schema";
import { contextoPagina } from "./contexto";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  const { supabase, atual, editor } = await contextoPagina();
  const daEmpresa = (tabela: string) =>
    supabase.from(tabela).select("*", { count: "exact", head: true }).eq("empresa_id", atual.id);
  const [catalogo, mapeamentos, indices, padroes, tabelas, bdis, composicoes, empresa] = await Promise.all([
    supabase.from("servicos_catalogo").select("chave"),
    supabase.from("servicos_mapeamento").select("id, empresa_id, chave, padrao, fonte, codigo, fator_conversao::text")
      .or(`empresa_id.is.null,empresa_id.eq.${atual.id}`),
    daEmpresa("indices_parametricos"),
    daEmpresa("padroes_acabamento"),
    daEmpresa("tabelas_parametricas"),
    daEmpresa("bdi_config"),
    daEmpresa("composicoes").is("base_id", null),
    supabase.from("empresas").select("logo_path").eq("id", atual.id).single(),
  ]);
  const erros = [catalogo, mapeamentos, indices, padroes, tabelas, bdis, composicoes, empresa]
    .map((r) => r.error).filter((e) => e !== null);

  const chaves = ((catalogo.data ?? []) as Array<{ chave: string }>).map((c) => c.chave);
  const mapeadas = contarMapeadas(chaves, paraMapeamentos((mapeamentos.data ?? []) as unknown as LinhaMapeamentoBanco[]));
  const temLogo = Boolean((empresa.data as { logo_path: string | null } | null)?.logo_path);

  const resumo: Record<string, string> = {
    "/configuracoes/mapeamento": `${mapeadas} de ${chaves.length} serviços do catálogo mapeados`,
    "/configuracoes/indices": `${indices.count ?? 0} de ${INDICES_PADRAO.length} índices personalizados`,
    "/configuracoes/padroes": `${padroes.count ?? 0} de ${PADROES.length} padrões personalizados`,
    "/configuracoes/tabelas": `${tabelas.count ?? 0} de ${CHAVES_TABELA.length} tabelas personalizadas`,
    "/configuracoes/bdi": `${bdis.count ?? 0} BDI(s) da empresa`,
    "/configuracoes/composicoes": `${composicoes.count ?? 0} composição(ões) própria(s)`,
    "/configuracoes/logo": temLogo ? "Logo enviado" : "Sem logo",
  };
  const pendenteMapeamento = chaves.length > 0 && mapeadas < chaves.length;

  return (
    <div className="flex flex-col gap-4">
      {erros.length ? <Alerta tom="perigo">Alguns totais não puderam ser carregados: {erros[0]?.message}</Alerta> : null}
      {!editor ? <Alerta tom="info">Seu acesso é somente leitura: você vê as configurações, mas não pode alterá-las.</Alerta> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECOES_CONFIGURACAO.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-acento">
              <CardBody className="flex h-full flex-col gap-2">
                <h2 className="font-semibold text-tinta group-hover:text-acento">{s.titulo}</h2>
                <p className="text-sm text-suave">{s.descricao}</p>
                <p className={s.href.endsWith("mapeamento") && pendenteMapeamento ? "mt-auto text-sm font-medium text-aviso" : "mt-auto text-sm font-medium text-tinta"}>
                  {resumo[s.href]}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
