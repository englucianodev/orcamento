"use client";
import { useRef, useState, useTransition } from "react";
import { registrarLogo, removerLogo } from "@/app/(app)/configuracoes/logo/acoes";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/form";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { mensagemDeErro } from "@/lib/utils";
import { arquivoLogoSchema, caminhoLogo, primeiroErro } from "./esquemas";
import { MensagemEstado } from "./formulario";
import type { EstadoAcao } from "./tipos";

interface Props {
  empresaId: string;
  temLogo: boolean;
}

/** Envio do logo direto do navegador para o Storage (bucket "logos") e registro na empresa. */
export function EnvioLogo({ empresaId, temLogo }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<EstadoAcao>({});
  const [enviando, iniciar] = useTransition();

  const enviar = () => {
    const arquivo = entrada.current?.files?.[0];
    if (!arquivo) {
      setEstado({ erro: "Escolha um arquivo PNG ou JPEG." });
      return;
    }
    const valido = arquivoLogoSchema.safeParse({ type: arquivo.type, size: arquivo.size });
    if (!valido.success) {
      setEstado({ erro: primeiroErro(valido.error) });
      return;
    }
    iniciar(async () => {
      try {
        const caminho = caminhoLogo(empresaId, valido.data.type);
        const { error } = await criarClienteNavegador().storage.from("logos")
          .upload(caminho, arquivo, { upsert: true, contentType: valido.data.type, cacheControl: "60" });
        if (error) {
          setEstado({ erro: `Não foi possível enviar a imagem: ${error.message}` });
          return;
        }
        setEstado(await registrarLogo(caminho));
        if (entrada.current) entrada.current.value = "";
      } catch (e) {
        setEstado({ erro: `Falha no envio: ${mensagemDeErro(e)}` });
      }
    });
  };

  const remover = () => {
    if (!window.confirm("Remover o logo da empresa?")) return;
    iniciar(async () => setEstado(await removerLogo()));
  };

  return (
    <div className="flex flex-col gap-3">
      <MensagemEstado estado={estado} />
      <Campo rotulo="Imagem (PNG ou JPEG, até 2 MB)" htmlFor="logo-arquivo">
        <input
          ref={entrada}
          id="logo-arquivo"
          type="file"
          accept="image/png,image/jpeg"
          className="text-sm file:mr-3 file:rounded-md file:border file:border-borda file:bg-superficie file:px-3 file:py-1.5 file:text-sm"
        />
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Button onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar logo"}</Button>
        {temLogo ? <Button variant="secundario" onClick={remover} disabled={enviando}>Remover logo</Button> : null}
      </div>
    </div>
  );
}
