import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const estiloBotao = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primario: "bg-acento text-white hover:bg-acento-forte",
        secundario: "border border-borda bg-superficie text-tinta hover:bg-fundo",
        fantasma: "text-tinta hover:bg-fundo",
        perigo: "bg-perigo text-white hover:opacity-90",
      },
      size: { md: "h-9 px-4", sm: "h-8 px-3 text-xs", icone: "h-8 w-8" },
    },
    defaultVariants: { variant: "primario", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof estiloBotao> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(estiloBotao({ variant, size }), className)} {...props} />;
}
