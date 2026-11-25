"use client";
/** Editor de um ambiente: medidas, paredes, acabamentos e vãos (portas/janelas). */
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CampoMarca, CampoNumero, CampoOpcoes, CampoTexto, Grade } from "./campos";
import { R } from "./rotulos";
import { novoId, type ValoresAssistente } from "./valores";

export function EditorAmbiente({ indice, pavimentos }: { indice: number; pavimentos: number }) {
  const { control } = useFormContext<ValoresAssistente>();
  const p = `entrada.ambientes.${indice}` as const;
  const { fields, append, remove } = useFieldArray({ control, name: `${p}.vaos`, keyName: "_chave" });
  const [modoParedes, duplo, revest, vaos] = useWatch({
    control, name: [`${p}.paredes.modo`, `${p}.peDireitoDuplo`, `${p}.revestimentoParede.tipo`, `${p}.vaos`],
  });
  const pavOpcoes = Array.from({ length: pavimentos }, (_, i) => [String(i + 1), `${i + 1}º`] as const);

  return (
    <div className="space-y-4">
      <Grade colunas={4}>
        <CampoTexto nome={`${p}.nome`} rotulo="Nome" />
        <CampoOpcoes nome={`${p}.tipo`} rotulo="Tipo" opcoes={R.tipoAmbiente} />
        {pavimentos > 1 ? <CampoOpcoes nome={`${p}.pavimento`} rotulo="Pavimento" opcoes={pavOpcoes} conversao="numero" /> : null}
        <CampoOpcoes nome={`${p}.areaMolhada`} rotulo="Área molhada" opcoes={R.molhada} conversao="booleano-nulo" />
      </Grade>
      <Grade colunas={4}>
        <CampoNumero nome={`${p}.largura`} rotulo="Largura" unidade="m" />
        <CampoNumero nome={`${p}.comprimento`} rotulo="Comprimento" unidade="m" />
        <CampoNumero nome={`${p}.areaManual`} rotulo="Área (se irregular)" unidade="m²" ajuda="Use no lugar de largura × comprimento." />
        <CampoNumero nome={`${p}.perimetroManual`} rotulo="Perímetro (se irregular)" unidade="m" ajuda="Vazio = estimado 4×√área." />
        <CampoNumero nome={`${p}.peDireito`} rotulo="Pé-direito" unidade="m" />
        <CampoMarca nome={`${p}.peDireitoDuplo`} rotulo="Pé-direito duplo" className="self-end pb-2" />
        {duplo ? <CampoNumero nome={`${p}.alturaLivre`} rotulo="Altura livre" unidade="m" ajuda="Vazio = 2 × pé-direito." /> : null}
      </Grade>
      <Grade colunas={4}>
        <CampoOpcoes nome={`${p}.paredes.modo`} rotulo="Paredes" opcoes={R.paredes} />
        {modoParedes === "parcial" ? <CampoNumero nome={`${p}.paredes.percentual`} rotulo="Perímetro com parede" unidade="%" /> : null}
        <CampoMarca nome={`${p}.externo`} rotulo="Ambiente externo" className="self-end pb-2" />
        <CampoMarca nome={`${p}.coberto`} rotulo="Coberto" className="self-end pb-2" />
      </Grade>
      <Grade colunas={4}>
        <CampoOpcoes nome={`${p}.piso`} rotulo="Piso" opcoes={R.piso} />
        <CampoOpcoes nome={`${p}.forro`} rotulo="Forro" opcoes={R.forro} />
        <CampoOpcoes nome={`${p}.pintura`} rotulo="Pintura" opcoes={R.pintura} />
        <CampoOpcoes nome={`${p}.revestimentoParede.tipo`} rotulo="Revestimento de parede" opcoes={R.revestimento} />
        {revest !== "nenhum" ? (
          <>
            <CampoNumero nome={`${p}.revestimentoParede.altura`} rotulo="Altura do revestimento" unidade="m" />
            <CampoMarca nome={`${p}.revestimentoParede.ateOTeto`} rotulo="Até o teto" className="self-end pb-2" />
          </>
        ) : null}
      </Grade>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Portas e janelas</p>
          <div className="flex gap-1">
            <Button size="sm" variant="secundario" onClick={() => append({ id: novoId(), tipo: "porta", quantidade: 1, largura: 0.8, altura: 2.1, material: "madeira_semioca", externa: false })}>+ Porta</Button>
            <Button size="sm" variant="secundario" onClick={() => append({ id: novoId(), tipo: "janela", quantidade: 1, largura: 1.2, altura: 1, material: "aluminio", externa: false })}>+ Janela</Button>
          </div>
        </div>
        <p className="text-xs text-suave">Cada porta entre dois ambientes é lançada em <strong>um só</strong> deles (senão ela é contada duas vezes).</p>
        {fields.length === 0 ? <p className="text-xs text-suave">Sem vãos.</p> : null}
        {fields.map((f, j) => {
          const v = `${p}.vaos.${j}` as const;
          const tipo = vaos?.[j]?.tipo ?? "porta";
          return (
            <div key={f._chave} className="grid grid-cols-2 items-end gap-2 rounded border border-borda/70 p-2 sm:grid-cols-7">
              <CampoOpcoes nome={`${v}.tipo`} rotulo="Tipo" opcoes={R.tipoVao} />
              <CampoNumero nome={`${v}.quantidade`} rotulo="Qtd." passo="1" />
              <CampoNumero nome={`${v}.largura`} rotulo="Largura" unidade="m" />
              <CampoNumero nome={`${v}.altura`} rotulo="Altura" unidade="m" />
              <CampoOpcoes nome={`${v}.material`} rotulo="Material" opcoes={tipo === "janela" ? R.materialJanela : R.materialPorta} />
              <CampoMarca nome={`${v}.externa`} rotulo="Para o exterior" className="pb-2" />
              <Button size="sm" variant="fantasma" className="text-perigo" onClick={() => remove(j)}>Remover</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
