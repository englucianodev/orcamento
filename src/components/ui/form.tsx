import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const campo =
  "w-full rounded-md border border-borda bg-superficie px-3 py-1.5 text-sm text-tinta placeholder:text-suave focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 disabled:opacity-60 aria-[invalid=true]:border-perigo";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(campo, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(campo, "min-h-20", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(campo, "h-9 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-suave", className)} {...props} />;
}

interface CampoProps {
  rotulo: string;
  htmlFor?: string;
  erro?: string;
  ajuda?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Rótulo + controle + mensagem de erro/ajuda. */
export function Campo({ rotulo, htmlFor, erro, ajuda, className, children }: CampoProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={htmlFor}>{rotulo}</Label>
      {children}
      {erro ? <p className="text-xs text-perigo" role="alert">{erro}</p> : ajuda ? <p className="text-xs text-suave">{ajuda}</p> : null}
    </div>
  );
}

export function Checkbox({ className, label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-tinta", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-borda accent-acento" {...props} />
      {label}
    </label>
  );
}
