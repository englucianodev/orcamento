"use client";
import { useActionState } from "react";
import { restaurarPadrao, salvarPadrao } from "@/app/(app)/configuracoes/padroes/acoes";
import { Button } from "@/components/ui/button";
import { Campo, Checkbox, Input, Select } from "@/components/ui/form";
import {
  MATERIAIS_JANELA, MATERIAIS_PORTA, TIPOS_FORRO, TIPOS_PINTURA, TIPOS_PISO, TIPOS_REVESTIMENTO_PAREDE, type Padrao,
} from "@/lib/engine/entrada.schema";
import type { ConfigPadrao, RevestimentoPadrao } from "@/lib/engine/padroes";
import { paraCampo } from "./decimais";
import { configPadraoDoFormulario, configPadraoSchema } from "./esquemas";
import { BotaoConfirmar, MensagemEstado, useValidacaoCliente } from "./formulario";
import { rotuloOpcao } from "./rotulos";
import { ESTADO_INICIAL } from "./tipos";

interface Props {
  padrao: Padrao;
  config: ConfigPadrao;
  personalizado: boolean;
}

function Opcoes({ valores }: { valores: readonly string[] }) {
  return <>{valores.map((v) => <option key={v} value={v}>{rotuloOpcao(v)}</option>)}</>;
}

function Escolha({ nome, rotulo, valores, atual, id }: { nome: string; rotulo: string; valores: readonly string[]; atual: string; id: string }) {
  return (
    <Campo rotulo={rotulo} htmlFor={`${id}-${nome}`}>
      <Select id={`${id}-${nome}`} name={nome} defaultValue={atual}><Opcoes valores={valores} /></Select>
    </Campo>
  );
}

function Revestimento({ nome, rotulo, valor, id }: { nome: string; rotulo: string; valor: RevestimentoPadrao; id: string }) {
  return (
    <fieldset className="flex flex-wrap items-end gap-3 rounded-md border border-borda p-3">
      <legend className="px-1 text-xs font-medium text-suave">{rotulo}</legend>
      <Escolha nome={`${nome}.tipo`} rotulo="Tipo" valores={TIPOS_REVESTIMENTO_PAREDE} atual={valor.tipo} id={id} />
      <Campo rotulo="Altura (m)" htmlFor={`${id}-${nome}-altura`}>
        <Input id={`${id}-${nome}-altura`} name={`${nome}.altura`} defaultValue={paraCampo(valor.altura)} inputMode="decimal" className="w-24" />
      </Campo>
      <Checkbox name={`${nome}.ateOTeto`} label="Até o teto" defaultChecked={valor.ateOTeto} className="pb-2" />
    </fieldset>
  );
}

/** Edição da matriz de acabamento de um padrão (seção 6.3). */
export function FormularioPadrao({ padrao, config, personalizado }: Props) {
  const [estado, salvar, salvando] = useActionState(salvarPadrao, ESTADO_INICIAL);
  const [estadoR, restaurar, restaurando] = useActionState(restaurarPadrao, ESTADO_INICIAL);
  const { erroCliente, aoEnviar } = useValidacaoCliente(configPadraoSchema, configPadraoDoFormulario);
  const id = `padrao-${padrao}`;
  return (
    <div className="flex flex-col gap-4">
      {/* key: remonta os campos quando o valor salvo muda (ex.: após restaurar) */}
      <form key={JSON.stringify(config)} action={salvar} onSubmit={aoEnviar} className="flex flex-col gap-4">
        <input type="hidden" name="padrao" value={padrao} />
        <MensagemEstado estado={estado.erro || estado.ok ? estado : estadoR} erroCliente={erroCliente} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo rotulo="Rótulo" htmlFor={`${id}-rotulo`}><Input id={`${id}-rotulo`} name="rotulo" defaultValue={config.rotulo} required /></Campo>
          <Escolha nome="pisoSeco" rotulo="Piso — áreas secas" valores={TIPOS_PISO} atual={config.pisoSeco} id={id} />
          <Escolha nome="pisoMolhado" rotulo="Piso — áreas molhadas" valores={TIPOS_PISO} atual={config.pisoMolhado} id={id} />
          <Escolha nome="pintura" rotulo="Pintura interna" valores={TIPOS_PINTURA} atual={config.pintura} id={id} />
          <Escolha nome="forroSeco" rotulo="Forro — áreas secas" valores={TIPOS_FORRO} atual={config.forroSeco} id={id} />
          <Escolha nome="forroMolhado" rotulo="Forro — áreas molhadas" valores={TIPOS_FORRO} atual={config.forroMolhado} id={id} />
          <Escolha nome="janela" rotulo="Esquadrias (janelas)" valores={MATERIAIS_JANELA} atual={config.janela} id={id} />
          <Escolha nome="portaInterna" rotulo="Portas internas" valores={MATERIAIS_PORTA} atual={config.portaInterna} id={id} />
          <Escolha nome="portaExterna" rotulo="Portas externas" valores={MATERIAIS_PORTA} atual={config.portaExterna} id={id} />
          <Campo rotulo="Bancadas (texto)" htmlFor={`${id}-bancadas`}><Input id={`${id}-bancadas`} name="bancadas" defaultValue={config.bancadas} /></Campo>
          <Campo rotulo="Louças e metais (texto)" htmlFor={`${id}-loucas`}><Input id={`${id}-loucas`} name="loucasMetais" defaultValue={config.loucasMetais} /></Campo>
          <Campo rotulo="Multiplicador de pontos elétricos" htmlFor={`${id}-mult`}>
            <Input id={`${id}-mult`} name="multiplicadorPontos" defaultValue={paraCampo(config.multiplicadorPontos)} inputMode="decimal" />
          </Campo>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Revestimento nome="revestimentoBanheiro" rotulo="Revestimento de banheiro" valor={config.revestimentoBanheiro} id={id} />
          <Revestimento nome="revestimentoCozinha" rotulo="Revestimento de cozinha / serviço" valor={config.revestimentoCozinha} id={id} />
        </div>
        <Checkbox name="sanca" label="Sanca de gesso" defaultChecked={config.sanca} />
        <div><Button type="submit" disabled={salvando}>Salvar padrão {config.rotulo}</Button></div>
      </form>
      {personalizado ? (
        <form action={restaurar}>
          <input type="hidden" name="padrao" value={padrao} />
          <BotaoConfirmar mensagem="Apagar a personalização da empresa e voltar ao padrão global?" variant="secundario" size="sm" disabled={restaurando}>
            Restaurar padrão global
          </BotaoConfirmar>
        </form>
      ) : null}
    </div>
  );
}
