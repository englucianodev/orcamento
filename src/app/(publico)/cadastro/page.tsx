import type { Metadata } from "next";
import { FormularioCadastro } from "../formulario-auth";

export const metadata: Metadata = { title: "Criar conta" };

export default async function PaginaCadastro({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const { voltar } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Criar conta</h1>
      <FormularioCadastro voltar={voltar ?? "/painel"} />
    </>
  );
}
