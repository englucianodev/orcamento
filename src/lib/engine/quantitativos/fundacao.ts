/** 7.2.3 Fundação e 7.2.4 Estrutura (estimativa paramétrica, substituível pelo projeto estrutural). */
import { D, type Dec } from "../decimal";
import type { Entrada } from "../entrada.schema";
import { n } from "../geometria";
import { item, type Contexto, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

type TipoFundacao = Exclude<Entrada["construcao"]["fundacao"], "automatico">;

export function resolverFundacao(e: Entrada): { tipo: TipoFundacao; memoria: string } {
  const f = e.construcao.fundacao;
  if (f !== "automatico") return { tipo: f, memoria: "" };
  if (e.dadosGerais.pavimentos >= 3) return { tipo: "helice_continua", memoria: " (automática: 3 ou mais pavimentos → hélice contínua)" };
  return { tipo: "estaca_broca", memoria: " (automática: até 2 pavimentos → estaca broca)" };
}

function baldrame({ idx, geo }: Contexto): ItemQuantitativo[] {
  const L = geo.terreo.comprimentoAlvenaria;
  const b = idx.baldrame_largura;
  const h = idx.baldrame_altura;
  const concreto = L.times(b).times(h);
  const forma = L.times(h).times(2);
  const aco = concreto.times(idx.baldrame_aco);
  const escavacao = L.times(b.plus(idx.baldrame_folga_escavacao)).times(h);
  const reaterro = escavacao.minus(concreto);
  const imper = L.times(b.plus(h.times(2)));
  const base = `Baldrame: comprimento de alvenaria do térreo ${n(L)} m`;
  return [
    ...item("ESCAVACAO_VALA_BALDRAME", escavacao, `${base} × (${n(b)} + ${n(idx.baldrame_folga_escavacao)}) × ${n(h)} = ${n(escavacao)} m³`),
    ...item("CONCRETO_BALDRAME", concreto, `${base} × ${n(b)} × ${n(h)} = ${n(concreto)} m³`),
    ...item("FORMA_BALDRAME", forma, `${base} × ${n(h)} × 2 faces = ${n(forma)} m²`),
    ...item("ARMACAO_BALDRAME", aco, `${n(concreto, 4)} m³ × ${n(idx.baldrame_aco, 0)} kg/m³ = ${n(aco)} kg`),
    ...item("REATERRO_VALA", reaterro, `Escavação ${n(escavacao)} − concreto ${n(concreto)} = ${n(reaterro)} m³`),
    ...item("IMPERMEABILIZACAO_BALDRAME", imper, `${base} × (${n(b)} + 2 × ${n(h)}) = ${n(imper)} m²`),
  ];
}

export const fundacao: EtapaQuantitativos = (ctx) => {
  const { idx, geo, entrada: e } = ctx;
  const { tipo, memoria } = resolverFundacao(e);
  if (tipo === "radier") {
    const concreto = geo.terreo.projecao.times(idx.radier_espessura);
    const aco = concreto.times(idx.radier_aco);
    return [
      ...item("CONCRETO_RADIER", concreto, `Radier: projeção ${n(geo.terreo.projecao)} × ${n(idx.radier_espessura)} = ${n(concreto)} m³`),
      ...item("ARMACAO_RADIER", aco, `${n(concreto, 4)} m³ × ${n(idx.radier_aco, 0)} kg/m³ = ${n(aco)} kg`),
    ];
  }
  const L = geo.terreo.comprimentoAlvenaria;
  const pilares = L.div(idx.pilar_espacamento).ceil();
  const memPilares = `⌈${n(L)} / ${n(idx.pilar_espacamento)}⌉ = ${pilares.toFixed(0)} pilares${memoria}`;
  const itens = baldrame(ctx);
  if (tipo === "sapata") {
    const concreto = pilares.times(idx.sapata_volume);
    const escav = concreto.times(idx.sapata_escavacao_fator);
    return [
      ...itens,
      ...item("CONCRETO_SAPATA", concreto, `${memPilares} × ${n(idx.sapata_volume)} m³ = ${n(concreto)} m³`),
      ...item("ESCAVACAO_SAPATA", escav, `${n(concreto)} m³ × ${n(idx.sapata_escavacao_fator)} = ${n(escav)} m³`),
      ...item("ARMACAO_SAPATA", concreto.times(idx.sapata_aco), `${n(concreto)} m³ × ${n(idx.sapata_aco, 0)} kg/m³`),
    ];
  }
  const helice = tipo === "helice_continua";
  const comp = helice ? idx.estaca_helice_comprimento : idx.estaca_broca_comprimento;
  const metros = pilares.times(idx.estacas_por_pilar).times(comp);
  return [
    ...itens,
    ...item(helice ? "ESTACA_HELICE_CONTINUA" : "ESTACA_BROCA", metros, `${memPilares} × ${n(idx.estacas_por_pilar, 0)} estaca × ${n(comp)} m = ${n(metros)} m`),
  ];
};

/** Laje acima do último pavimento? Não há quando é telhado e todo o pavimento tem forro. */
export function temLajeCobertura(ctx: Contexto): boolean {
  const e = ctx.entrada;
  if (e.cobertura.telha === "laje_impermeabilizada") return true;
  if (e.construcao.laje === "sem_laje") return false;
  const topo = ctx.geo.pavimentos[ctx.geo.pavimentos.length - 1]!;
  return topo.ambientes.some((g) => g.ambiente.coberto && g.ambiente.forro === "sem_forro");
}

export const estrutura: EtapaQuantitativos = (ctx) => {
  const { idx, geo, entrada: e } = ctx;
  const A = geo.areaConstruida;
  const saida: ItemQuantitativo[] = [];
  if (e.construcao.estrutura === "metalica") {
    saida.push(...item("ESTRUTURA_METALICA", A.times(idx.estrutura_metalica), `Área construída ${n(A)} × ${n(idx.estrutura_metalica)} kg/m²`));
  } else {
    const fator: Dec = e.construcao.estrutura === "alvenaria_estrutural" ? idx.fator_alvenaria_estrutural : new D(1);
    const concreto = A.times(idx.estrutura_concreto).times(fator);
    const txtFator = fator.eq(1) ? "" : ` × ${n(fator)} (alvenaria estrutural)`;
    saida.push(
      ...item("CONCRETO_ESTRUTURA", concreto, `Área construída ${n(A)} × ${n(idx.estrutura_concreto)} m³/m²${txtFator} = ${n(concreto)} m³`),
      ...item("ARMACAO_ESTRUTURA", concreto.times(idx.estrutura_aco), `${n(concreto)} m³ × ${n(idx.estrutura_aco, 0)} kg/m³`),
      ...item("FORMA_ESTRUTURA", concreto.times(idx.estrutura_forma), `${n(concreto)} m³ × ${n(idx.estrutura_forma, 0)} m²/m³`),
    );
  }
  const chaveLaje = e.construcao.laje === "macica" ? "LAJE_MACICA" : "LAJE_TRELICADA";
  for (const p of geo.pavimentos.slice(1)) {
    saida.push(...item(chaveLaje, p.projecao, `Laje de piso do pavimento ${p.numero}: projeção ${n(p.projecao)} m²`));
  }
  if (temLajeCobertura(ctx)) {
    const topo = geo.pavimentos[geo.pavimentos.length - 1]!;
    saida.push(...item(chaveLaje, topo.projecao, `Laje de cobertura: projeção do pavimento ${topo.numero} ${n(topo.projecao)} m²`));
  }
  const escadas = e.dadosGerais.pavimentos - 1;
  saida.push(...item("ESCADA_CONCRETO", new D(escadas), `${e.dadosGerais.pavimentos} pavimentos → ${escadas} lance(s) de escada`));
  return saida;
};
