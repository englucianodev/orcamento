"use client";
/**
 * Assistente de 10 passos (seção 10). Um único formulário (react-hook-form) com validação Zod por passo,
 * salvamento automático do rascunho (debounce) e resumo ao vivo.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { FormProvider, useForm, type Path } from "react-hook-form";
import { gerarOrcamento, salvarRascunho, type EstadoGeracao } from "@/app/(app)/orcamentos/acoes";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EtapaAmbientes } from "./etapa-ambientes";
import { EtapaCobertura, EtapaConstrucao, EtapaDados, EtapaTerreno, type BaseDisponivel } from "./etapas-obra";
import { EtapaFinal, EtapaOrcamento, EtapaRevisao, type OpcaoBdi } from "./etapas-finais";
import { EtapaInstalacoes, EtapaLazer } from "./etapas-sistemas";
import { ResumoVivo } from "./resumo-vivo";
import { PASSOS, TOTAL_PASSOS, passoDoCaminho, validarPasso, type ValoresAssistente } from "./valores";

const ESPERA_AUTOSAVE_MS = 1200;
type EstadoSalvo = "" | "pendente" | "salvando" | "salvo" | "erro";

export interface PropsAssistente {
  orcamentoId: string;
  inicial: ValoresAssistente;
  passoInicial: number;
  bases: BaseDisponivel[];
  bdis: OpcaoBdi[];
  indices: Record<string, string>;
  somenteLeitura: string | null;
}

export function Assistente({ orcamentoId, inicial, passoInicial, bases, bdis, indices, somenteLeitura }: PropsAssistente) {
  const form = useForm<ValoresAssistente>({ defaultValues: inicial, mode: "onTouched" });
  const [passo, setPasso] = useState(Math.min(Math.max(passoInicial, 1), TOTAL_PASSOS));
  const [salvo, setSalvo] = useState<EstadoSalvo>("");
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [geracao, setGeracao] = useState<EstadoGeracao | null>(null);
  const [gerando, iniciarGeracao] = useTransition();
  const passoRef = useRef(passo);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const router = useRouter();
  passoRef.current = passo;

  const salvar = useCallback(async (): Promise<boolean> => {
    if (somenteLeitura) return true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSalvo("salvando");
    const v = form.getValues();
    try {
      const r = await salvarRascunho(orcamentoId, v.entrada, passoRef.current, v.meta);
      setSalvo(r.erro ? "erro" : "salvo");
      setErroSalvar(r.erro ?? null);
      return !r.erro;
    } catch {
      setSalvo("erro");
      setErroSalvar("Sem conexão ou sessão expirada: o rascunho não foi salvo. Tente de novo.");
      return false;
    }
  }, [form, orcamentoId, somenteLeitura]);

  useEffect(() => {
    if (somenteLeitura) return undefined;
    const sub = form.watch(() => {
      setSalvo("pendente");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void salvar(); }, ESPERA_AUTOSAVE_MS);
    });
    // ao sair da página com um salvamento pendente, salva agora em vez de descartar
    return () => { sub.unsubscribe(); if (timer.current) void salvar(); };
  }, [form, salvar, somenteLeitura]);

  const irPara = (n: number) => {
    setPasso(n);
    passoRef.current = n;
    void salvar();
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Valida o passo; em erro marca os campos e (se o erro é de outro passo) leva até ele. */
  const validar = (n: number): boolean => {
    form.clearErrors();
    const erros = validarPasso(n, form.getValues());
    if (erros.length === 0) return true;
    for (const e of erros) form.setError(e.caminho as Path<ValoresAssistente>, { type: "zod", message: e.mensagem });
    const destino = passoDoCaminho(erros[0]!.caminho);
    if (destino !== n) setPasso(destino);
    return false;
  };

  const avancar = () => { if (validar(passo)) irPara(Math.min(passo + 1, TOTAL_PASSOS)); };

  const gerar = () => {
    if (!validar(9)) return;
    iniciarGeracao(async () => {
      if (!(await salvar())) return;
      const r = await gerarOrcamento(orcamentoId);
      setGeracao(r);
      if (!r.erro) { irPara(10); router.refresh(); }
    });
  };

  const rotuloSalvo = { "": "", pendente: "Alterações não salvas…", salvando: "Salvando…", salvo: "Rascunho salvo", erro: "Falha ao salvar" }[salvo];

  return (
    <FormProvider {...form}>
      <div ref={topo} className="scroll-mt-4 space-y-5">
        <nav aria-label="Passos do assistente">
          <ol className="grid grid-cols-5 gap-1 lg:grid-cols-10">
            {PASSOS.map((t, i) => {
              const n = i + 1;
              return (
                <li key={t}>
                  <button type="button" disabled={n > passo && !somenteLeitura} onClick={() => irPara(n)}
                    aria-current={n === passo ? "step" : undefined}
                    className={cn("w-full border-t-4 pt-1.5 text-left text-[11px] leading-tight", n < passo ? "border-acento text-tinta" : n === passo ? "border-acento font-semibold text-acento" : "border-borda text-suave")}>
                    <span className="font-mono">{n}.</span> {t}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        {somenteLeitura ? <Alerta tom="aviso">{somenteLeitura}</Alerta> : null}
        {erroSalvar ? <Alerta tom="perigo" titulo="O rascunho não foi salvo">{erroSalvar}</Alerta> : null}

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <form onSubmit={(e) => e.preventDefault()} noValidate className="min-w-0 space-y-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{passo}. {PASSOS[passo - 1]}</h2>
              <span className="text-xs text-suave" aria-live="polite">{rotuloSalvo}</span>
            </div>
            <fieldset disabled={Boolean(somenteLeitura) || gerando} className="min-w-0">
              {passo === 1 ? <EtapaDados bases={bases} /> : null}
              {passo === 2 ? <EtapaTerreno /> : null}
              {passo === 3 ? <EtapaConstrucao /> : null}
              {passo === 4 ? <EtapaAmbientes /> : null}
              {passo === 5 ? <EtapaCobertura /> : null}
              {passo === 6 ? <EtapaInstalacoes /> : null}
              {passo === 7 ? <EtapaLazer /> : null}
              {passo === 8 ? <EtapaRevisao orcamentoId={orcamentoId} /> : null}
              {passo === 9 ? <EtapaOrcamento bdis={bdis} /> : null}
            </fieldset>
            {passo === 10 ? <EtapaFinal orcamentoId={orcamentoId} geracao={geracao} /> : null}
            {passo === 9 && geracao?.erro ? <Alerta tom="perigo" titulo="Não foi possível gerar">{geracao.erro}</Alerta> : null}

            <div className="flex flex-wrap justify-between gap-2 border-t border-borda pt-4">
              <Button variant="secundario" disabled={passo === 1} onClick={() => irPara(passo - 1)}>Voltar</Button>
              {passo < 9 ? <Button onClick={avancar}>Próximo</Button> : null}
              {passo === 9 ? (
                <Button onClick={gerar} disabled={gerando || Boolean(somenteLeitura)}>{gerando ? "Gerando orçamento…" : "Gerar orçamento"}</Button>
              ) : null}
            </div>
          </form>
          <div className="lg:sticky lg:top-4 lg:self-start"><ResumoVivo indices={indices} /></div>
        </div>
      </div>
    </FormProvider>
  );
}
