/** 7.2.15 Piscina. */
import { D, type Dec } from "../decimal";
import type { Entrada } from "../entrada.schema";
import { n } from "../geometria";
import type { Indices } from "../indices";
import { item, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

type DimensoesPiscina = Pick<Entrada["lazer"]["piscina"], "comprimento" | "largura" | "profundidadeMin" | "profundidadeMax">;

export interface GeometriaPiscina {
  profundidadeMedia: Dec;
  espelho: Dec;
  perimetro: Dec;
  volume: Dec;
  escavacao: Dec;
  paredes: Dec;
  /** fundo + paredes = C × L + 2 × (C + L) × Pm (impermeabilização e revestimento) */
  revestimento: Dec;
}

export function geometriaPiscina(p: DimensoesPiscina, idx: Indices): GeometriaPiscina {
  const C = new D(p.comprimento);
  const L = new D(p.largura);
  const profundidadeMedia = new D(p.profundidadeMin).plus(p.profundidadeMax).div(2);
  const espelho = C.times(L);
  const perimetro = C.plus(L).times(2);
  const folga = idx.piscina_folga_escavacao;
  const escavacao = C.plus(folga).times(L.plus(folga)).times(profundidadeMedia.plus(idx.piscina_sobreprofundidade));
  const paredes = perimetro.times(profundidadeMedia);
  return {
    profundidadeMedia, espelho, perimetro, volume: espelho.times(profundidadeMedia), escavacao, paredes,
    revestimento: espelho.plus(paredes),
  };
}

function estruturaPiscina(tipo: Entrada["lazer"]["piscina"]["tipo"], g: GeometriaPiscina, idx: Indices): ItemQuantitativo[] {
  const esp = idx.piscina_espessura;
  const memRev = `${n(g.espelho)} + ${n(g.perimetro)} × ${n(g.profundidadeMedia)} = ${n(g.revestimento)} m²`;
  if (tipo === "fibra") return item("PISCINA_FIBRA", new D(1), `Piscina de fibra com espelho de ${n(g.espelho)} m²`);
  const concreto = (tipo === "concreto_armado" ? g.revestimento : g.espelho).times(esp);
  const memConc = tipo === "concreto_armado"
    ? `Fundo e paredes ${n(g.revestimento)} m² × ${n(esp)} = ${n(concreto)} m³`
    : `Fundo ${n(g.espelho)} m² × ${n(esp)} = ${n(concreto)} m³`;
  const saida = [
    ...item("CONCRETO_PISCINA", concreto, memConc),
    ...item("ARMACAO_PISCINA", concreto.times(idx.piscina_aco), `${n(concreto)} m³ × ${n(idx.piscina_aco, 0)} kg/m³`),
  ];
  const memParedes = `Paredes ${n(g.perimetro)} × ${n(g.profundidadeMedia)} = ${n(g.paredes)} m²`;
  if (tipo === "concreto_armado") saida.push(...item("FORMA_PISCINA", g.paredes, memParedes));
  else saida.push(...item("ALVENARIA_PISCINA", g.paredes, memParedes));
  if (tipo === "vinil") return [...saida, ...item("VINIL_PISCINA", g.revestimento, memRev)];
  return [
    ...saida,
    ...item("IMPERMEABILIZACAO_PISCINA", g.revestimento, memRev),
    ...item("REVESTIMENTO_PISCINA", g.revestimento, memRev),
  ];
}

export const piscina: EtapaQuantitativos = ({ entrada: e, idx }) => {
  const p = e.lazer.piscina;
  if (!p.existe) return [];
  const g = geometriaPiscina(p, idx);
  const botaFora = g.escavacao.times(idx.empolamento);
  const vazao = g.volume.div(idx.piscina_recirculacao_h);
  const saida = [
    ...item("ESCAVACAO_PISCINA", g.escavacao,
      `(${n(new D(p.comprimento))} + ${n(idx.piscina_folga_escavacao)}) × (${n(new D(p.largura))} + ${n(idx.piscina_folga_escavacao)}) × (${n(g.profundidadeMedia)} + ${n(idx.piscina_sobreprofundidade)}) = ${n(g.escavacao)} m³`),
    ...item("BOTA_FORA_PISCINA", botaFora, `${n(g.escavacao)} × empolamento ${n(idx.empolamento)} = ${n(botaFora)} m³`),
    ...estruturaPiscina(p.tipo, g, idx),
    ...item("FILTRO_BOMBA_PISCINA", new D(1),
      `Volume ${n(g.volume)} m³ (${n(new D(p.comprimento))}×${n(new D(p.largura))}×${n(g.profundidadeMedia)}) / ${n(idx.piscina_recirculacao_h, 0)} h = vazão ${n(vazao)} m³/h`),
  ];
  if (p.borda) saida.push(...item("BORDA_PISCINA", g.perimetro, `Perímetro 2 × (${n(new D(p.comprimento))} + ${n(new D(p.largura))}) = ${n(g.perimetro)} m`));
  if (p.casaMaquinas) saida.push(...item("CASA_MAQUINAS", new D(1), "1 casa de máquinas"));
  if (p.iluminacao) {
    const refletores = D.max(1, g.espelho.div(idx.piscina_area_por_refletor).ceil());
    saida.push(...item("REFLETOR_PISCINA", refletores, `⌈${n(g.espelho)} / ${n(idx.piscina_area_por_refletor, 0)}⌉ = ${refletores.toFixed(0)}`));
  }
  if (p.aquecimento === "solar") saida.push(...item("AQUECIMENTO_PISCINA_SOLAR", g.espelho, `Coletores ≈ espelho d'água ${n(g.espelho)} m²`));
  if (p.aquecimento === "bomba_calor") saida.push(...item("AQUECIMENTO_PISCINA_BOMBA_CALOR", new D(1), `Para ${n(g.volume)} m³`));
  if (p.aquecimento === "gas") saida.push(...item("AQUECIMENTO_PISCINA_GAS", new D(1), `Para ${n(g.volume)} m³`));
  return saida;
};
