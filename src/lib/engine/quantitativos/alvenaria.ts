/** 7.2.5 Alvenaria/vedação. */
import { D, soma } from "../decimal";
import type { Entrada } from "../entrada.schema";
import { n } from "../geometria";
import { item, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

export function chaveAlvenaria(c: Entrada["construcao"]): string {
  if (c.estrutura === "alvenaria_estrutural") return "ALV_ESTRUTURAL_BLOCO_CONCRETO_14CM";
  if (c.vedacao === "drywall") return "DRYWALL_PAREDE";
  const cm = c.espessuraParede <= 0.11 ? "9CM" : c.espessuraParede <= 0.165 ? "14CM" : "19CM";
  return c.vedacao === "bloco_ceramico" ? `ALV_BLOCO_CERAMICO_${cm}` : `ALV_BLOCO_CONCRETO_${cm}`;
}

export const alvenaria: EtapaQuantitativos = ({ entrada: e, idx, geo }) => {
  const chave = chaveAlvenaria(e.construcao);
  const saida: ItemQuantitativo[] = [];
  for (const p of geo.pavimentos) {
    const bruta = p.comprimentoAlvenaria.times(p.peDireitoMedio);
    const liquida = bruta.minus(p.vaosDescontados);
    saida.push(...item(chave, liquida,
      `Pavimento ${p.numero}: (Σ perímetros + perímetro externo ${n(p.perimetroExterno)}) / 2 = ${n(p.comprimentoAlvenaria)} m × pé-direito médio ${n(p.peDireitoMedio)} − vãos ${n(p.vaosDescontados)} = ${n(liquida)} m²`));
  }
  const pb = e.cobertura.platibanda;
  if (pb.existe && pb.altura > 0) {
    const topo = geo.pavimentos[geo.pavimentos.length - 1]!;
    const area = topo.perimetroExterno.times(pb.altura);
    saida.push(...item(chave, area, `Platibanda: perímetro externo ${n(topo.perimetroExterno)} × ${n(new D(pb.altura))} = ${n(area)} m²`));
  }
  const vaos = e.ambientes.flatMap((a) => a.vaos);
  const vergas = soma(vaos.map((v) => new D(v.largura).plus(idx.verga_transpasse).times(v.quantidade).times(2)));
  if (e.construcao.vedacao !== "drywall" || e.construcao.estrutura === "alvenaria_estrutural") {
    saida.push(...item("VERGA_CONTRAVERGA", vergas, `Σ (largura do vão + ${n(idx.verga_transpasse)}) × quantidade × 2 (verga e contraverga) em ${vaos.length} vão(s) = ${n(vergas)} m`));
  }
  if (e.construcao.estrutura === "concreto_armado" && e.construcao.vedacao !== "drywall") {
    const enc = soma(geo.pavimentos.map((p) => p.comprimentoAlvenaria));
    saida.push(...item("ENCUNHAMENTO", enc, `Σ comprimento de alvenaria dos pavimentos = ${n(enc)} m`));
  }
  return saida;
};
