"use client";
import { useActionState, useState, type FormEvent } from "react";
import { restaurarTabela, salvarTabela } from "@/app/(app)/configuracoes/tabelas/acoes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { BotaoConfirmar, MensagemEstado } from "./formulario";
import { validarTabela, type ChaveTabela } from "./tabelas-esquemas";
import { ESTADO_INICIAL } from "./tipos";

interface Props {
  chave: ChaveTabela;
  json: string;
  personalizada: boolean;
}

/** Edição de uma tabela paramétrica em JSON, validada pelo schema do tipo TabelasMotor. */
export function EditorTabela({ chave, json, personalizada }: Props) {
  const [estado, salvar, salvando] = useActionState(salvarTabela, ESTADO_INICIAL);
  const [estadoR, restaurar, restaurando] = useActionState(restaurarTabela, ESTADO_INICIAL);
  const [erroCliente, setErroCliente] = useState<string | null>(null);

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    const texto = new FormData(e.currentTarget).get("config");
    const r = validarTabela(chave, typeof texto === "string" ? texto : "");
    if (!r.ok) {
      e.preventDefault();
      setErroCliente(r.erro);
      return;
    }
    setErroCliente(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <MensagemEstado estado={estado.erro || estado.ok ? estado : estadoR} erroCliente={erroCliente} />
      <form key={json} action={salvar} onSubmit={aoEnviar} className="flex flex-col gap-3">
        <input type="hidden" name="chave" value={chave} />
        <Textarea
          name="config"
          defaultValue={json}
          spellCheck={false}
          aria-label={`JSON da tabela ${chave}`}
          aria-invalid={Boolean(erroCliente)}
          rows={Math.min(24, Math.max(4, json.split("\n").length + 1))}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={salvando}>Salvar</Button>
        </div>
      </form>
      {personalizada ? (
        <form action={restaurar}>
          <input type="hidden" name="chave" value={chave} />
          <BotaoConfirmar mensagem="Apagar a tabela da empresa e voltar à global?" variant="secundario" size="sm" disabled={restaurando}>
            Restaurar global
          </BotaoConfirmar>
        </form>
      ) : null}
    </div>
  );
}
