"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { salvarBdi } from "@/app/(app)/configuracoes/bdi/acoes";
import { Button, estiloBotao } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/form";
import { verificarFaixasBdi } from "@/lib/engine/bdi";
import { D } from "@/lib/engine/decimal";
import { faixasDoBanco, type LinhaFaixa } from "@/lib/orcamento/config";
import { br, percentualParaFracao } from "./decimais";
import {
  bdiDoFormulario, bdiSchema, COMPONENTES_BDI, ROTULO_COMPONENTE_BDI, TIPOS_OBRA_BDI,
  type ComponenteFormBdi, type DadosBdi, type FormBdi,
} from "./esquemas";
import { rotuloOpcao } from "./rotulos";
import type { EstadoAcao } from "./tipos";

interface Props {
  inicial: FormBdi;
  faixas: readonly LinhaFaixa[];
}

/** Painel ao vivo: BDI pela fórmula do TCU e alertas das faixas de referência. */
function ResultadoAoVivo({ valores, tipoObra, faixas }: { valores: Partial<Record<ComponenteFormBdi, string>>; tipoObra: string; faixas: readonly LinhaFaixa[] }) {
  const bdi = bdiDoFormulario(valores);
  if (bdi === null) return <Alerta tom="neutro">Preencha todos os componentes para calcular o BDI.</Alerta>;
  const fracoes = Object.fromEntries(COMPONENTES_BDI.map((c) => [c, percentualParaFracao(valores[c] ?? "0")])) as Record<ComponenteFormBdi, string>;
  const alertas = verificarFaixasBdi(fracoes, faixasDoBanco(faixas, tipoObra));
  const percentual = new D(bdi).times(100).toFixed(2).replace(".", ",");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-suave">
        BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − I)) − 1 ={" "}
        <span className="font-mono text-lg font-semibold text-tinta">{percentual}%</span>
      </p>
      {alertas.length ? (
        <Alerta tom="aviso" titulo={`Fora das faixas de referência do TCU (${rotuloOpcao(tipoObra)})`}>
          <ul className="list-disc pl-4">{alertas.map((a) => <li key={a.componente}>{a.mensagem}</li>)}</ul>
        </Alerta>
      ) : faixas.some((f) => f.tipo_obra === tipoObra) ? (
        <Alerta tom="sucesso">Dentro das faixas de referência do TCU.</Alerta>
      ) : null}
    </div>
  );
}

/** Criação/edição de BDI da empresa (react-hook-form + Zod), em percentual. */
export function FormularioBdi({ inicial, faixas }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoAcao>({});
  const [enviando, iniciar] = useTransition();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormBdi, unknown, DadosBdi>({
    // os campos são texto; o schema aceita texto (com vírgula) e devolve os percentuais normalizados
    resolver: zodResolver(bdiSchema) as Resolver<FormBdi, unknown, DadosBdi>,
    defaultValues: inicial,
  });
  const valores = useWatch({ control });

  const enviar = (dados: DadosBdi) => {
    iniciar(async () => {
      const r = await salvarBdi(dados);
      setEstado(r);
      if (!r.ok) return;
      if (inicial.id) router.replace("/configuracoes/bdi");
      else reset();
    });
  };
  const erroDe = (c: keyof FormBdi): string | undefined => errors[c]?.message;

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
      {estado.erro ? <Alerta tom="perigo">{estado.erro}</Alerta> : null}
      {estado.ok ? <Alerta tom="sucesso">{estado.ok}</Alerta> : null}
      <input type="hidden" {...register("id")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Nome" htmlFor="bdi-nome" erro={erroDe("nome")}>
          <Input id="bdi-nome" {...register("nome")} aria-invalid={Boolean(errors.nome)} />
        </Campo>
        <Campo rotulo="Aplicação" htmlFor="bdi-tipo" erro={erroDe("tipo")}>
          <Select id="bdi-tipo" {...register("tipo")}>
            <option value="servico">Serviços</option>
            <option value="material">Fornecimento de materiais</option>
          </Select>
        </Campo>
        <Campo rotulo="Tipo de obra (faixas do TCU)" htmlFor="bdi-obra" erro={erroDe("tipo_obra")}>
          <Select id="bdi-obra" {...register("tipo_obra")}>
            {TIPOS_OBRA_BDI.map((t) => <option key={t} value={t}>{rotuloOpcao(t)}</option>)}
          </Select>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {COMPONENTES_BDI.map((c) => (
          <Campo key={c} rotulo={`${ROTULO_COMPONENTE_BDI[c]} %`} htmlFor={`bdi-${c}`} erro={erroDe(c)}>
            <Input id={`bdi-${c}`} inputMode="decimal" className="text-right font-mono" {...register(c)} aria-invalid={Boolean(errors[c])} />
          </Campo>
        ))}
      </div>
      <ResultadoAoVivo valores={valores} tipoObra={valores.tipo_obra ?? "edificacoes"} faixas={faixas} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>{inicial.id ? "Salvar alterações" : "Criar BDI"}</Button>
        {inicial.id ? <Link href="/configuracoes/bdi" className={estiloBotao({ variant: "secundario" })}>Cancelar edição</Link> : null}
      </div>
      <p className="text-xs text-suave">Os percentuais são gravados como fração (ex.: {br("6.65")}% → 0,0665).</p>
    </form>
  );
}
