import Link from "next/link";
import type { ReactNode } from "react";
import { SECOES_CONFIGURACAO } from "@/components/configuracoes/rotulos";

export default function LayoutConfiguracoes({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold text-tinta">
          <Link href="/configuracoes" className="hover:text-acento">Configurações</Link>
        </h1>
        <nav aria-label="Seções de configuração" className="flex flex-wrap gap-1 text-sm">
          {SECOES_CONFIGURACAO.map((s) => (
            <Link key={s.href} href={s.href} className="rounded px-2 py-1 text-suave hover:bg-fundo hover:text-tinta">
              {s.titulo}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
