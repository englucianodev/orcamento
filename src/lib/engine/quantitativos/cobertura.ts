/** 7.2.6 Cobertura. */
import { D, ZERO, type Dec } from "../decimal";
import type { Entrada } from "../entrada.schema";
import { n } from "../geometria";
import { item, type EtapaQuantitativos } from "./tipos";

export interface GeometriaTelhado {
  largura: Dec;
  comprimento: Dec;
  projecao: Dec;
  fatorInclinacao: Dec;
  areaInclinada: Dec;
}

/** Projeção com beiral = (Lp + 2b) × (Cp + 2b); área inclinada = projeção × √(1 + (i/100)²). */
export function geometriaTelhado(lp: Dec | number, cp: Dec | number, beiral: number, inclinacaoPct: number): GeometriaTelhado {
  const b2 = new D(beiral).times(2);
  const largura = new D(lp).plus(b2);
  const comprimento = new D(cp).plus(b2);
  const projecao = largura.times(comprimento);
  const i = new D(inclinacaoPct).div(100);
  const fatorInclinacao = i.pow(2).plus(1).sqrt();
  return { largura, comprimento, projecao, fatorInclinacao, areaInclinada: projecao.times(fatorInclinacao) };
}

const TELHA: Record<Exclude<Entrada["cobertura"]["telha"], "laje_impermeabilizada">, string> = {
  ceramica: "TELHA_CERAMICA", concreto: "TELHA_CONCRETO", fibrocimento: "TELHA_FIBROCIMENTO",
  metalica: "TELHA_METALICA", termoacustica: "TELHA_TERMOACUSTICA", shingle: "TELHA_SHINGLE",
};

function cumeeira(t: GeometriaTelhado, aguas: number, i: Dec): { metros: Dec; memoria: string } {
  const maior = D.max(t.largura, t.comprimento);
  const menor = D.min(t.largura, t.comprimento);
  if (aguas === 1) return { metros: ZERO, memoria: "" };
  if (aguas === 2) return { metros: maior, memoria: `2 águas: maior dimensão = ${n(maior)} m` };
  const meio = menor.div(2);
  const espigao = meio.pow(2).times(2).plus(meio.times(i).pow(2)).sqrt();
  const total = maior.minus(menor).plus(espigao.times(4));
  return { metros: total, memoria: `4 águas: cumeeira ${n(maior.minus(menor))} + 4 espigões × ${n(espigao)} = ${n(total)} m` };
}

export const cobertura: EtapaQuantitativos = ({ entrada: e, idx, geo }) => {
  const c = e.cobertura;
  const t = geometriaTelhado(geo.terreo.largura, geo.terreo.comprimento, c.beiral, c.inclinacao);
  const perimetro = t.largura.plus(t.comprimento).times(2);
  const memProj = `(${n(geo.terreo.largura)} + 2×${n(new D(c.beiral))}) × (${n(geo.terreo.comprimento)} + 2×${n(new D(c.beiral))}) = ${n(t.projecao)} m²`;
  if (c.telha === "laje_impermeabilizada") {
    const area = t.projecao.plus(perimetro.times(idx.laje_impermeabilizada_rodape));
    return item("IMPERMEABILIZACAO_LAJE_COBERTURA", area,
      `${memProj} + perímetro ${n(perimetro)} × ${n(idx.laje_impermeabilizada_rodape)} = ${n(area)} m²`);
  }
  const memIncl = `${memProj} × √(1 + ${n(new D(c.inclinacao).div(100))}²) = ${n(t.areaInclinada)} m²`;
  const cum = cumeeira(t, c.aguas, new D(c.inclinacao).div(100));
  const saida = [
    ...item(TELHA[c.telha], t.areaInclinada, memIncl),
    ...item(c.estrutura === "madeira" ? "ESTRUTURA_TELHADO_MADEIRA" : "ESTRUTURA_TELHADO_METALICA", t.areaInclinada, memIncl),
    ...item("CUMEEIRA", cum.metros, cum.memoria),
  ];
  const maior = D.max(t.largura, t.comprimento);
  const beirais = c.aguas === 1 ? maior : c.aguas === 2 ? maior.times(2) : perimetro;
  const comPlatibanda = c.platibanda.existe;
  if (c.calhas) {
    const m = comPlatibanda ? perimetro : beirais;
    saida.push(...item("CALHA", m, comPlatibanda ? `Com platibanda: perímetro = ${n(m)} m` : `Beirais de ${c.aguas} água(s) = ${n(m)} m`));
  }
  if (c.rufos && comPlatibanda) saida.push(...item("RUFO", perimetro, `Com platibanda: perímetro = ${n(perimetro)} m`));
  return saida;
};
