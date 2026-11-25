import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Tabela({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, numerico, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) {
  return (
    <th
      className={cn(
        "border-b border-borda bg-fundo px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-suave",
        numerico && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, numerico, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) {
  return <td className={cn("border-b border-borda/70 px-3 py-2 align-top", numerico && "text-right font-mono tabular-nums", className)} {...props} />;
}
