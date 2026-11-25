import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { aceitarConvite } from "../../(app)/acoes-empresa";

export const metadata: Metadata = { title: "Convite" };

export default async function PaginaConvite({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { token } = await params;
  const { erro } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/entrar?voltar=${encodeURIComponent(`/convite/${token}`)}`);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-borda bg-superficie p-6">
        <h1 className="mb-2 text-lg font-semibold">Convite para empresa</h1>
        <p className="mb-4 text-sm text-suave">Você entrou como <strong>{data.user.email}</strong>. Aceite para acessar os orçamentos da empresa.</p>
        {erro ? <Alerta tom="perigo" className="mb-4">{erro}</Alerta> : null}
        <form action={aceitarConvite}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full">Aceitar convite</Button>
        </form>
      </div>
    </main>
  );
}
