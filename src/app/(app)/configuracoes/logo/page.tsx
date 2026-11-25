import type { Metadata } from "next";
import { EnvioLogo } from "@/components/configuracoes/envio-logo";
import { Alerta, Card, CardBody, CardHeader, Vazio } from "@/components/ui/card";
import { contextoPagina } from "../contexto";

export const metadata: Metadata = { title: "Logo da empresa" };

const VALIDADE_URL_SEGUNDOS = 3600;

export default async function PaginaLogo() {
  const { supabase, atual, admin } = await contextoPagina();
  const { data, error } = await supabase.from("empresas").select("logo_path").eq("id", atual.id).single();
  const caminho = (data as { logo_path: string | null } | null)?.logo_path ?? null;
  let url: string | null = null;
  let erroUrl: string | null = null;
  if (caminho) {
    const assinada = await supabase.storage.from("logos").createSignedUrl(caminho, VALIDADE_URL_SEGUNDOS);
    if (assinada.error) erroUrl = assinada.error.message;
    else url = assinada.data.signedUrl;
  }

  return (
    <Card>
      <CardHeader titulo="Logo da empresa" descricao="Exibido no cabeçalho dos relatórios em PDF e Excel." />
      <CardBody className="flex flex-col gap-5">
        {error ? <Alerta tom="perigo">Não foi possível carregar a empresa: {error.message}</Alerta> : null}
        {erroUrl ? <Alerta tom="aviso">Não foi possível abrir o logo atual: {erroUrl}</Alerta> : null}
        {url ? (
          <div className="flex h-32 w-64 items-center justify-center rounded-md border border-borda bg-white p-2">
            {/* URL assinada e temporária do Storage: next/image exigiria configurar o domínio remoto */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Logo de ${atual.nome}`} className="max-h-full max-w-full object-contain" />
          </div>
        ) : !caminho ? <Vazio titulo="Nenhum logo enviado" /> : null}
        {admin ? (
          <EnvioLogo empresaId={atual.id} temLogo={Boolean(caminho)} />
        ) : (
          <Alerta tom="info">Somente administradores da empresa podem alterar o logo.</Alerta>
        )}
      </CardBody>
    </Card>
  );
}
