"use client";
import { useActionState } from "react";
import { restaurarIndice, salvarIndice } from "@/app/(app)/configuracoes/indices/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { paraCampo } from "./decimais";
import { indiceSchema } from "./esquemas";
import { useValidacaoCliente } from "./formulario";
import { ESTADO_INICIAL } from "./tipos";

interface Props {
  chave: string;
  valorEmpresa: string | null;
  valorGlobal: string;
}

/** Edição do valor da empresa de um índice (salvar / restaurar o global). */
export function EdicaoIndice({ chave, valorEmpresa, valorGlobal }: Props) {
  const [estado, salvar, salvando] = useActionState(salvarIndice, ESTADO_INICIAL);
  const [estadoR, restaurar, restaurando] = useActionState(restaurarIndice, ESTADO_INICIAL);
  const { erroCliente, aoEnviar } = useValidacaoCliente(indiceSchema);
  const mensagem = erroCliente ?? estado.erro ?? estadoR.erro;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <form action={salvar} onSubmit={aoEnviar} className="flex items-center gap-2">
          <input type="hidden" name="chave" value={chave} />
          <Input
            key={valorEmpresa ?? "global"}
            name="valor"
            defaultValue={paraCampo(valorEmpresa)}
            placeholder={paraCampo(valorGlobal)}
            inputMode="decimal"
            aria-label={`Valor da empresa para ${chave}`}
            aria-invalid={Boolean(mensagem)}
            className="h-8 w-28 text-right font-mono"
            required
          />
          <Button type="submit" size="sm" variant="secundario" disabled={salvando}>Salvar</Button>
        </form>
        {valorEmpresa !== null ? (
          <form action={restaurar}>
            <input type="hidden" name="chave" value={chave} />
            <Button type="submit" size="sm" variant="fantasma" disabled={restaurando} title="Apaga o valor da empresa e volta a usar o global">
              Restaurar
            </Button>
          </form>
        ) : null}
      </div>
      {mensagem ? <p className="text-xs text-perigo" role="alert">{mensagem}</p> : null}
      {!mensagem && (estado.ok || estadoR.ok) ? <p className="text-xs text-sucesso">{estado.ok ?? estadoR.ok}</p> : null}
    </div>
  );
}
