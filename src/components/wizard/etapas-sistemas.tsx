"use client";
/** Passos 6 e 7 do assistente: instalações e lazer/áreas externas. */
import { useFormContext, useWatch } from "react-hook-form";
import { CampoMarca, CampoNumero, CampoOpcoes, Grade, Secao } from "./campos";
import { R } from "./rotulos";
import type { ValoresAssistente } from "./valores";

export function EtapaInstalacoes() {
  return (
    <div className="space-y-5">
      <Secao titulo="Hidrossanitária">
        <Grade>
          <CampoOpcoes nome="entrada.instalacoes.aguaQuente" rotulo="Água quente" opcoes={R.aguaQuente} />
          <CampoOpcoes nome="entrada.instalacoes.esgoto" rotulo="Esgoto" opcoes={R.esgoto} />
          <CampoNumero nome="entrada.instalacoes.moradores" rotulo="Moradores" passo="1" ajuda="Vazio = 2 por quarto/suíte." />
          <CampoNumero nome="entrada.instalacoes.reservatorioLitros" rotulo="Reservatório" unidade="L" passo="1" ajuda="Vazio = calculado pelo consumo." />
          <CampoNumero nome="entrada.instalacoes.cisternaLitros" rotulo="Cisterna" unidade="L" passo="1" />
        </Grade>
      </Secao>
      <Secao titulo="Elétrica e sistemas">
        <Grade>
          <CampoNumero nome="entrada.instalacoes.solarKwp" rotulo="Energia solar" unidade="kWp" />
          <CampoNumero nome="entrada.instalacoes.pontosAr" rotulo="Pontos de ar-condicionado" passo="1" />
          <CampoNumero nome="entrada.instalacoes.cftvCameras" rotulo="Câmeras de CFTV" passo="1" />
        </Grade>
        <div className="flex flex-wrap gap-4">
          <CampoMarca nome="entrada.instalacoes.spda" rotulo="SPDA (para-raios)" />
          <CampoMarca nome="entrada.instalacoes.automacao" rotulo="Automação" />
          <CampoMarca nome="entrada.instalacoes.redeLogica" rotulo="Rede lógica" />
        </div>
      </Secao>
    </div>
  );
}

export function EtapaLazer() {
  const { control } = useFormContext<ValoresAssistente>();
  const piscina = useWatch({ control, name: "entrada.lazer.piscina.existe" });
  return (
    <div className="space-y-5">
      <Secao titulo="Piscina">
        <CampoMarca nome="entrada.lazer.piscina.existe" rotulo="Tem piscina" />
        {piscina ? (
          <>
            <Grade colunas={4}>
              <CampoNumero nome="entrada.lazer.piscina.comprimento" rotulo="Comprimento" unidade="m" />
              <CampoNumero nome="entrada.lazer.piscina.largura" rotulo="Largura" unidade="m" />
              <CampoNumero nome="entrada.lazer.piscina.profundidadeMin" rotulo="Profundidade mínima" unidade="m" />
              <CampoNumero nome="entrada.lazer.piscina.profundidadeMax" rotulo="Profundidade máxima" unidade="m" />
              <CampoOpcoes nome="entrada.lazer.piscina.tipo" rotulo="Tipo" opcoes={R.piscina} />
              <CampoOpcoes nome="entrada.lazer.piscina.aquecimento" rotulo="Aquecimento" opcoes={R.aquecimentoPiscina} />
            </Grade>
            <div className="flex flex-wrap gap-4">
              <CampoMarca nome="entrada.lazer.piscina.iluminacao" rotulo="Iluminação" />
              <CampoMarca nome="entrada.lazer.piscina.casaMaquinas" rotulo="Casa de máquinas" />
              <CampoMarca nome="entrada.lazer.piscina.borda" rotulo="Borda / pedra de acabamento" />
            </div>
          </>
        ) : null}
      </Secao>
      <Secao titulo="Área gourmet">
        <Grade>
          <CampoOpcoes nome="entrada.lazer.gourmet.churrasqueira" rotulo="Churrasqueira" opcoes={R.churrasqueira} />
          <CampoNumero nome="entrada.lazer.gourmet.bancadaMetros" rotulo="Bancada" unidade="m" />
        </Grade>
        <div className="flex flex-wrap gap-4">
          <CampoMarca nome="entrada.lazer.gourmet.pia" rotulo="Pia" />
          <CampoMarca nome="entrada.lazer.gourmet.fornoPizza" rotulo="Forno de pizza" />
          <CampoMarca nome="entrada.lazer.gourmet.coifa" rotulo="Coifa" />
        </div>
      </Secao>
      <Secao titulo="Áreas externas">
        <Grade colunas={4}>
          <CampoNumero nome="entrada.lazer.deckM2" rotulo="Deck" unidade="m²" />
          <CampoNumero nome="entrada.lazer.pergoladoM2" rotulo="Pergolado" unidade="m²" />
          <CampoNumero nome="entrada.lazer.paisagismoM2" rotulo="Paisagismo" unidade="m²" />
          <CampoNumero nome="entrada.lazer.quadraM2" rotulo="Quadra" unidade="m²" />
        </Grade>
        <div className="flex flex-wrap gap-4">
          <CampoMarca nome="entrada.lazer.sauna" rotulo="Sauna" />
          <CampoMarca nome="entrada.lazer.playground" rotulo="Playground" />
          <CampoMarca nome="entrada.lazer.canil" rotulo="Canil" />
        </div>
      </Secao>
    </div>
  );
}
