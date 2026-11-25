"use client";
/** Campos ligados ao react-hook-form do assistente (nome = caminho em ValoresAssistente). */
import { get, useFormContext, useFormState, type RegisterOptions } from "react-hook-form";
import { Campo, Checkbox, Input, Select } from "@/components/ui/form";
import type { Opcoes } from "./rotulos";
import { paraNumero, type ValoresAssistente } from "./valores";

// caminhos dinâmicos (ambientes.N.vaos.M…) — a tipagem estrita fica nos schemas Zod
type Caminho = string;

function useErro(nome: Caminho): string | undefined {
  const { errors } = useFormState<ValoresAssistente>();
  const e = get(errors, nome) as { message?: string } | undefined;
  return e?.message;
}

const idDe = (nome: string) => `c-${nome.replace(/\./g, "-")}`;

interface Base {
  nome: Caminho;
  rotulo: string;
  ajuda?: string;
  className?: string;
}

export function CampoNumero({ nome, rotulo, ajuda, className, unidade, passo = "any", min }: Base & { unidade?: string; passo?: string; min?: number }) {
  const { register } = useFormContext();
  const erro = useErro(nome);
  const id = idDe(nome);
  return (
    <Campo rotulo={unidade ? `${rotulo} (${unidade})` : rotulo} htmlFor={id} erro={erro} ajuda={ajuda} className={className}>
      <Input id={id} type="number" inputMode="decimal" step={passo} min={min} aria-invalid={Boolean(erro)}
        {...register(nome, { setValueAs: paraNumero } as RegisterOptions)} />
    </Campo>
  );
}

export function CampoTexto({ nome, rotulo, ajuda, className, placeholder }: Base & { placeholder?: string }) {
  const { register } = useFormContext();
  const erro = useErro(nome);
  const id = idDe(nome);
  return (
    <Campo rotulo={rotulo} htmlFor={id} erro={erro} ajuda={ajuda} className={className}>
      <Input id={id} placeholder={placeholder} aria-invalid={Boolean(erro)} {...register(nome)} />
    </Campo>
  );
}

type Conversao = "texto" | "numero" | "booleano-nulo" | "nulo";

const CONVERTER: Record<Conversao, (v: unknown) => unknown> = {
  texto: (v) => v,
  numero: (v) => Number(v),
  "booleano-nulo": (v) => (v === "" || v === null ? null : v === "true" || v === true),
  nulo: (v) => (v === "" ? null : v),
};

export function CampoOpcoes({ nome, rotulo, ajuda, className, opcoes, conversao = "texto", vazio }: Base & { opcoes: Opcoes; conversao?: Conversao; vazio?: string }) {
  const { register } = useFormContext();
  const erro = useErro(nome);
  const id = idDe(nome);
  return (
    <Campo rotulo={rotulo} htmlFor={id} erro={erro} ajuda={ajuda} className={className}>
      <Select id={id} aria-invalid={Boolean(erro)} {...register(nome, { setValueAs: CONVERTER[conversao] } as RegisterOptions)}>
        {vazio !== undefined ? <option value="">{vazio}</option> : null}
        {opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </Select>
    </Campo>
  );
}

export function CampoMarca({ nome, rotulo, className }: Omit<Base, "ajuda">) {
  const { register } = useFormContext();
  return <Checkbox label={rotulo} className={className} {...register(nome)} />;
}

/** Grade responsiva para os campos de um passo. */
export function Grade({ children, colunas = 3 }: { children: React.ReactNode; colunas?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[colunas];
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>;
}

export function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-md border border-borda p-4">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      {descricao ? <p className="text-xs text-suave">{descricao}</p> : null}
      {children}
    </fieldset>
  );
}
