/** Entradas de exemplo para os testes do motor (dados fictícios). */
import { entradaSchema, type Ambiente, type Entrada, type EntradaBruta, type Padrao, type TipoAmbiente } from "@/lib/engine/entrada.schema";
import { interpretarAtalho, sugerirAmbiente } from "@/lib/engine/padroes";

export function quartoAceite(): Ambiente {
  return {
    id: "q1", tipo: "quarto", nome: "Quarto 1", pavimento: 1, largura: 3, comprimento: 4,
    areaManual: null, perimetroManual: null, peDireito: 2.8, peDireitoDuplo: false, alturaLivre: null,
    paredes: { modo: "todas", percentual: 100 }, externo: false, coberto: true, areaMolhada: null,
    vaos: [
      { id: "p1", tipo: "porta", quantidade: 1, largura: 0.8, altura: 2.1, material: "madeira_semioca", externa: false },
      { id: "j1", tipo: "janela", quantidade: 1, largura: 1.2, altura: 1, material: "aluminio", externa: false },
    ],
    piso: "ceramica_pei4", revestimentoParede: { tipo: "nenhum", altura: 0, ateOTeto: false },
    forro: "gesso_placa", pintura: "latex_pva",
  };
}

export function entrada(ambientes: Ambiente[], extra: Partial<EntradaBruta> = {}, padrao: Padrao = "baixo"): Entrada {
  return entradaSchema.parse({
    versao: 1,
    dadosGerais: { nome: "Obra teste", uf: "PI", padrao, pavimentos: Math.max(...ambientes.map((a) => a.pavimento)) },
    terreno: { largura: 12, profundidade: 30 },
    cobertura: { telha: "ceramica" },
    ambientes,
    ...extra,
  });
}

/** Casa do caso E2E: 3 quartos, 1 suíte, sala, cozinha, 2 banheiros, área gourmet e piscina. */
export function casaCompleta(padrao: Padrao = "normal"): Entrada {
  const ambientes: Ambiente[] = [];
  const add = (tipo: TipoAmbiente, qtd: number) => {
    for (let i = 1; i <= qtd; i++) ambientes.push(sugerirAmbiente(tipo, padrao, `${tipo}-${i}`, i));
  };
  for (const { tipo, quantidade } of interpretarAtalho("3 quartos, 1 suíte, 1 sala, 1 cozinha, 2 banheiros, área gourmet, área de serviço")) {
    add(tipo, quantidade);
  }
  return entrada(ambientes, {
    terreno: { largura: 15, profundidade: 30, desnivel: 1, muro: { frente: true, fundos: true, esquerda: true, direita: true, altura: 2.2 }, portao: { existe: true, largura: 3, altura: 2.2, tipo: "deslizante", automatizado: true } },
    instalacoes: { aguaQuente: "solar", esgoto: "fossa_sumidouro", solarKwp: 4, pontosAr: 3, spda: false, cftvCameras: 4, redeLogica: true },
    lazer: {
      piscina: { existe: true, comprimento: 8, largura: 4, profundidadeMin: 1.2, profundidadeMax: 1.6 },
      gourmet: { churrasqueira: "alvenaria", bancadaMetros: 3, pia: true, fornoPizza: false, coifa: true },
      paisagismoM2: 40,
    },
  }, padrao);
}
