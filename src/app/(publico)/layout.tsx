import type { ReactNode } from "react";

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-1 font-mono text-xs tracking-[0.3em] text-suave">ORÇAOBRA</p>
        <div className="rounded-lg border border-borda bg-superficie p-6 shadow-sm">{children}</div>
        <p className="mt-4 text-center text-xs text-suave">Orçamentos de obras por ambientes · SINAPI e SICRO</p>
      </div>
    </main>
  );
}
