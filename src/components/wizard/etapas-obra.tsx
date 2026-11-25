"use client";
/** Passos 1, 2, 3 e 5 do assistente: dados gerais, terreno, construção e cobertura. */
import { useFormContext, useWatch } from "react-hook-form";
import { UFS } from "@/lib/engine/entrada.schema";
import { Alerta } from "@/components/ui/card";
import { mesAno } from "@/lib/utils";
import { CampoMarca, CampoNumero, CampoOpcoes, CampoTexto, Grade, Secao } from "./campos";
import { R } from "./rotulos";
import type { ValoresAssistente } from "./valores";

export interface BaseDisponivel {
  fonte: "SINAPI" | "SICRO";
  uf: string;
  mes_ano: string;
  desonerado: boolean;
}

const UF_OPCOES = UFS.map((u) => [u, u] as const);

export function EtapaDados({ bases }: { bases: BaseDisponivel[] }) {
  const { control } = useFormContext<ValoresAssistente>();
  const uf = useWatch({ control, name: "entrada.dadosGerais.uf" });
  const desonerado = useWatch({ control, name: "entrada.dadosGerais.desonerado" });
  const meses = (fonte: BaseDisponivel["fonte"]) => {
    const unicos = new Set(bases.filter((b) => b.fonte === fonte && b.uf === uf && (fonte === "SICRO" || b.desonerado === Boolean(desonerado))).map((b) => b.mes_ano));
    return [...unicos].sort().reverse().map((m) => [m, mesAno(m)] as const);
  };
  const sinapi = meses("SINAPI");
  const sicro = meses("SICRO");
  return (
    <div className="space-y-5">
      <Secao titulo="Obra">
        <Grade>
          <CampoTexto nome="entrada.dadosGerais.nome" rotulo="Nome da obra" />
          <CampoTexto nome="entrada.dadosGerais.cliente" rotulo="Cliente" />
          <CampoTexto nome="entrada.dadosGerais.municipio" rotulo="Município" />
          <CampoOpcoes nome="entrada.dadosGerais.uf" rotulo="UF" opcoes={UF_OPCOES} />
          <CampoOpcoes nome="entrada.dadosGerais.padrao" rotulo="Padrão de acabamento" opcoes={R.padrao}
            ajuda="Define pisos, revestimentos, esquadrias e louças sugeridos (editáveis em Configurações → Padrões)." />
          <CampoNumero nome="entrada.dadosGerais.pavimentos" rotulo="Pavimentos" passo="1" min={1} />
        </Grade>
      </Secao>
      <Secao titulo="Data-base e encargos" descricao="Os preços vêm das bases oficiais importadas para a UF escolhida.">
        <Grade>
          <CampoMarca nome="entrada.dadosGerais.desonerado" rotulo="Preços desonerados" className="sm:col-span-2 lg:col-span-3" />
          <CampoOpcoes nome="entrada.dadosGerais.mesBase" rotulo="Mês-base SINAPI" opcoes={sinapi} conversao="nulo" vazio="Selecione…" />
          <CampoOpcoes nome="meta.mes_base_sicro" rotulo="Mês-base SICRO (opcional)" opcoes={sicro} conversao="nulo" vazio="Igual ao SINAPI"
            ajuda="Usado nos serviços mapeados para o SICRO (terraplenagem, pavimentação)." />
          <CampoNumero nome="meta.cub_m2" rotulo="CUB de referência" unidade="R$/m²" ajuda="Opcional: compara o custo/m² com o CUB do sindicato." />
        </Grade>
        {sinapi.length === 0 ? (
          <Alerta tom="aviso" titulo={`Nenhuma base SINAPI importada para ${uf ?? "a UF"} (${desonerado ? "desonerado" : "não desonerado"}).`}>
            Você pode continuar descrevendo a obra; os preços aparecem quando a base for importada em Admin · Bases.
          </Alerta>
        ) : null}
      </Secao>
      <Secao titulo="Responsável técnico" descricao="Aparece no cabeçalho dos relatórios.">
        <Grade>
          <CampoTexto nome="meta.responsavel.nome" rotulo="Nome" />
          <CampoTexto nome="meta.responsavel.registro" rotulo="CREA / CAU" />
          <CampoTexto nome="meta.responsavel.art" rotulo="ART / RRT" />
        </Grade>
      </Secao>
    </div>
  );
}

export function EtapaTerreno() {
  const { control } = useFormContext<ValoresAssistente>();
  const topografia = useWatch({ control, name: "entrada.terreno.topografia" });
  const portao = useWatch({ control, name: "entrada.terreno.portao.existe" });
  const passeio = useWatch({ control, name: "entrada.terreno.passeioPublico.existe" });
  return (
    <div className="space-y-5">
      <Secao titulo="Dimensões e solo">
        <Grade>
          <CampoNumero nome="entrada.terreno.largura" rotulo="Largura (frente)" unidade="m" />
          <CampoNumero nome="entrada.terreno.profundidade" rotulo="Profundidade" unidade="m" />
          <CampoOpcoes nome="entrada.terreno.topografia" rotulo="Topografia" opcoes={R.topografia} />
          {topografia !== "plano" ? <CampoNumero nome="entrada.terreno.desnivel" rotulo="Desnível" unidade="m" /> : null}
          <CampoOpcoes nome="entrada.terreno.solo" rotulo="Solo" opcoes={R.solo} />
          <CampoOpcoes nome="entrada.terreno.vegetacao" rotulo="Vegetação" opcoes={R.vegetacao} />
          <CampoNumero nome="entrada.terreno.dmtBotaForaKm" rotulo="Distância do bota-fora" unidade="km" ajuda="Vazio = índice padrão." />
        </Grade>
      </Secao>
      <Secao titulo="Muros e portão">
        <div className="flex flex-wrap gap-4">
          <CampoMarca nome="entrada.terreno.muro.frente" rotulo="Muro na frente" />
          <CampoMarca nome="entrada.terreno.muro.fundos" rotulo="Fundos" />
          <CampoMarca nome="entrada.terreno.muro.esquerda" rotulo="Lateral esquerda" />
          <CampoMarca nome="entrada.terreno.muro.direita" rotulo="Lateral direita" />
        </div>
        <Grade>
          <CampoNumero nome="entrada.terreno.muro.altura" rotulo="Altura do muro" unidade="m" />
        </Grade>
        <CampoMarca nome="entrada.terreno.portao.existe" rotulo="Portão de veículos" />
        {portao ? (
          <Grade colunas={4}>
            <CampoNumero nome="entrada.terreno.portao.largura" rotulo="Largura" unidade="m" />
            <CampoNumero nome="entrada.terreno.portao.altura" rotulo="Altura" unidade="m" />
            <CampoOpcoes nome="entrada.terreno.portao.tipo" rotulo="Tipo" opcoes={R.portao} />
            <CampoMarca nome="entrada.terreno.portao.automatizado" rotulo="Automatizado" className="self-end pb-2" />
          </Grade>
        ) : null}
      </Secao>
      <Secao titulo="Calçadas">
        <div className="flex flex-wrap gap-4">
          <CampoMarca nome="entrada.terreno.calcadaPerimetral" rotulo="Calçada perimetral à casa" />
          <CampoMarca nome="entrada.terreno.passeioPublico.existe" rotulo="Passeio público" />
        </div>
        {passeio ? <Grade><CampoNumero nome="entrada.terreno.passeioPublico.largura" rotulo="Largura do passeio" unidade="m" /></Grade> : null}
      </Secao>
    </div>
  );
}

export function EtapaConstrucao() {
  return (
    <div className="space-y-5">
      <Secao titulo="Sistema construtivo">
        <Grade>
          <CampoOpcoes nome="entrada.construcao.estrutura" rotulo="Estrutura" opcoes={R.estrutura} />
          <CampoOpcoes nome="entrada.construcao.fundacao" rotulo="Fundação" opcoes={R.fundacao} />
          <CampoOpcoes nome="entrada.construcao.laje" rotulo="Laje" opcoes={R.laje} />
          <CampoOpcoes nome="entrada.construcao.vedacao" rotulo="Vedação" opcoes={R.vedacao} />
          <CampoNumero nome="entrada.construcao.espessuraParede" rotulo="Espessura da parede" unidade="m" />
        </Grade>
      </Secao>
      <Secao titulo="Projeção do térreo (opcional)" descricao="Sem projeção, o sistema estima pela soma das áreas + paredes (índice k_paredes), e mostra a memória.">
        <Grade>
          <CampoNumero nome="entrada.construcao.projecaoLargura" rotulo="Largura" unidade="m" />
          <CampoNumero nome="entrada.construcao.projecaoComprimento" rotulo="Comprimento" unidade="m" />
        </Grade>
      </Secao>
    </div>
  );
}

export function EtapaCobertura() {
  const { control } = useFormContext<ValoresAssistente>();
  const platibanda = useWatch({ control, name: "entrada.cobertura.platibanda.existe" });
  return (
    <div className="space-y-5">
      <Secao titulo="Telhado">
        <Grade>
          <CampoOpcoes nome="entrada.cobertura.telha" rotulo="Telha" opcoes={R.telha} />
          <CampoNumero nome="entrada.cobertura.inclinacao" rotulo="Inclinação" unidade="%" />
          <CampoOpcoes nome="entrada.cobertura.aguas" rotulo="Águas" opcoes={R.aguas} conversao="numero" />
          <CampoNumero nome="entrada.cobertura.beiral" rotulo="Beiral" unidade="m" />
          <CampoOpcoes nome="entrada.cobertura.estrutura" rotulo="Estrutura do telhado" opcoes={R.estruturaCobertura} />
        </Grade>
      </Secao>
      <Secao titulo="Complementos">
        <div className="flex flex-wrap gap-4">
          <CampoMarca nome="entrada.cobertura.calhas" rotulo="Calhas" />
          <CampoMarca nome="entrada.cobertura.rufos" rotulo="Rufos" />
          <CampoMarca nome="entrada.cobertura.platibanda.existe" rotulo="Platibanda" />
        </div>
        {platibanda ? <Grade><CampoNumero nome="entrada.cobertura.platibanda.altura" rotulo="Altura da platibanda" unidade="m" /></Grade> : null}
      </Secao>
    </div>
  );
}
