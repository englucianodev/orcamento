import type { Metadata } from "next";
import { FormularioEntrar } from "../formulario-auth";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: { searchParams: Promise<{ voltar?: string; erro?: string }> }) {
  const { voltar, erro } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Entrar</h1>
      {erro ? <p className="mb-3 text-sm text-perigo">O link de acesso expirou ou é inválido. Tente de novo.</p> : null}
      <FormularioEntrar voltar={voltar ?? "/painel"} />
    </>
  );
}
