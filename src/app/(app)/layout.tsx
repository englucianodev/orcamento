import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { contextoEmpresa } from "@/lib/empresa";
import { sair } from "../(publico)/acoes";
import { trocarEmpresa } from "./acoes-empresa";

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const ctx = await contextoEmpresa();
  const links = [
    { href: "/painel", rotulo: "Orçamentos" },
    { href: "/bases", rotulo: "Bases" },
    { href: "/configuracoes", rotulo: "Configurações" },
    { href: "/empresa", rotulo: "Empresa" },
    ...(ctx.adminPlataforma ? [{ href: "/admin/bases", rotulo: "Admin · Bases" }] : []),
  ];
  return (
    <div className="min-h-screen">
      <header className="nao-imprimir border-b border-borda bg-superficie">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/painel" className="font-mono text-sm font-semibold tracking-[0.25em] text-acento">ORÇAOBRA</Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded px-2 py-1 text-suave hover:bg-fundo hover:text-tinta">{l.rotulo}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {ctx.empresas.length > 1 ? (
              <form action={trocarEmpresa} className="flex items-center gap-1">
                <label htmlFor="empresa" className="sr-only">Empresa</label>
                <select id="empresa" name="empresa" defaultValue={ctx.atual?.id} className="h-8 rounded border border-borda bg-superficie px-2 text-sm">
                  {ctx.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <Button type="submit" size="sm" variant="secundario">Trocar</Button>
              </form>
            ) : ctx.atual ? <span className="text-suave">{ctx.atual.nome}</span> : null}
            <span className="hidden text-suave md:inline">{ctx.usuario.email}</span>
            <form action={sair}><Button type="submit" size="sm" variant="fantasma">Sair</Button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
