import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-borda bg-superficie", className)} {...props} />;
}

export function CardHeader({ titulo, descricao, acoes, className }: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-borda px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-tinta">{titulo}</h2>
        {descricao ? <p className="mt-0.5 text-sm text-suave">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

type Tom = "neutro" | "info" | "sucesso" | "aviso" | "perigo";
const TONS: Record<Tom, string> = {
  neutro: "bg-fundo text-suave border-borda",
  info: "bg-info/10 text-info border-info/30",
  sucesso: "bg-sucesso/10 text-sucesso border-sucesso/30",
  aviso: "bg-aviso/10 text-aviso border-aviso/30",
  perigo: "bg-perigo/10 text-perigo border-perigo/30",
};

export function Badge({ tom = "neutro", className, children }: { tom?: Tom; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium", TONS[tom], className)}>{children}</span>;
}

export function Alerta({ tom = "info", titulo, className, children }: { tom?: Tom; titulo?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div role={tom === "perigo" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", TONS[tom], className)}>
      {titulo ? <p className="font-medium">{titulo}</p> : null}
      {children ? <div className={cn(titulo && "mt-1", "text-tinta/80")}>{children}</div> : null}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-borda px-6 py-10 text-center">
      <p className="font-medium text-tinta">{titulo}</p>
      {children ? <div className="mt-2 text-sm text-suave">{children}</div> : null}
    </div>
  );
}
