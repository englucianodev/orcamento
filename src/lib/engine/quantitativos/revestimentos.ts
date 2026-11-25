/** 7.2.7 Revestimentos, 7.2.8 Forro e 7.2.9 Impermeabilização. */
import { D, ZERO, soma, type Dec } from "../decimal";
import type { TIPOS_PISO, TipoForro, Vao } from "../entrada.schema";
import { n, vaoDescontavel, type GeoAmbiente } from "../geometria";
import type { Indices } from "../indices";
import { temLajeCobertura } from "./fundacao";
import { item, type Contexto, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

type TipoPiso = (typeof TIPOS_PISO)[number];

export function memoriaArea(g: GeoAmbiente): string {
  const a = g.ambiente;
  return a.largura !== null && a.comprimento !== null
    ? `${a.nome}: ${n(new D(a.largura))}×${n(new D(a.comprimento))} = ${n(g.area)} m²`
    : `${a.nome}: área informada ${n(g.area)} m²`;
}

export function alturaRevestimento(g: GeoAmbiente): Dec {
  const r = g.ambiente.revestimentoParede;
  if (r.tipo === "nenhum") return ZERO;
  return r.ateOTeto ? g.altura : D.min(r.altura, g.altura);
}

function faixaDoVao(v: Vao, peitoril: Dec): [Dec, Dec] {
  return v.tipo === "porta" ? [ZERO, new D(v.altura)] : [peitoril, peitoril.plus(v.altura)];
}

/** Revestimento de parede = P × altura do revestimento − vãos dentro dessa faixa. */
export function areaRevestimentoParede(g: GeoAmbiente, idx: Indices): { area: Dec; memoria: string } {
  const h = alturaRevestimento(g);
  if (h.isZero() || g.fracao.isZero()) return { area: ZERO, memoria: "" };
  const bruta = g.perimetroParede.times(h);
  const desc = soma(g.ambiente.vaos.filter((v) => vaoDescontavel(v, idx)).map((v) => {
    const [base, topo] = faixaDoVao(v, idx.janela_peitoril);
    const sobreposicao = D.max(ZERO, D.min(topo, h).minus(base));
    return sobreposicao.times(v.largura).times(v.quantidade);
  }));
  const area = D.max(ZERO, bruta.minus(desc));
  const txtDesc = desc.isZero() ? "" : ` − ${n(desc)} (vãos na faixa)`;
  return { area, memoria: `${g.ambiente.nome}: ${n(g.perimetroParede)} × ${n(h)}${txtDesc} = ${n(area)} m²` };
}

/** Fachada = Σ P_externo × pé-direito médio (+ platibanda) − vãos externos. */
export function areaFachada({ entrada: e, geo }: Contexto): { area: Dec; memoria: string } {
  const partes = geo.pavimentos.map((p) => p.perimetroExterno.times(p.peDireitoMedio));
  const topo = geo.pavimentos[geo.pavimentos.length - 1]!;
  const pb = e.cobertura.platibanda;
  const plat = pb.existe ? topo.perimetroExterno.times(pb.altura) : ZERO;
  const area = D.max(ZERO, soma(partes).plus(plat).minus(geo.vaosExternos));
  const txt = geo.pavimentos.map((p) => `${n(p.perimetroExterno)}×${n(p.peDireitoMedio)}`).join(" + ");
  const txtPlat = plat.isZero() ? "" : ` + platibanda ${n(plat)}`;
  return { area, memoria: `${txt}${txtPlat} − vãos externos ${n(geo.vaosExternos)} = ${n(area)} m²` };
}

const PISO: Record<TipoPiso, string | null> = {
  ceramica_pei4: "PISO_CERAMICA_PEI4", porcelanato_60x60: "PISO_PORCELANATO_60X60",
  porcelanato_90x90: "PISO_PORCELANATO_90X90", porcelanato_grande_formato: "PISO_PORCELANATO_GRANDE_FORMATO",
  marmore: "PISO_MARMORE", laminado: "PISO_LAMINADO", vinilico: "PISO_VINILICO", cimentado: "PISO_CIMENTADO",
  deck_madeira: "PISO_DECK_MADEIRA", nenhum: null,
};

const RODAPE: Record<TipoPiso, string | null> = {
  ceramica_pei4: "RODAPE_CERAMICO", porcelanato_60x60: "RODAPE_PORCELANATO", porcelanato_90x90: "RODAPE_PORCELANATO",
  porcelanato_grande_formato: "RODAPE_PORCELANATO", marmore: "RODAPE_MARMORE", laminado: "RODAPE_MADEIRA",
  vinilico: "RODAPE_MADEIRA", deck_madeira: "RODAPE_MADEIRA", cimentado: null, nenhum: null,
};

const larguras = (vaos: readonly Vao[]): Dec => soma(vaos.map((v) => new D(v.largura).times(v.quantidade)));

function revestimentosAmbiente(g: GeoAmbiente, idx: Indices): ItemQuantitativo[] {
  const a = g.ambiente;
  const saida = [
    ...item("CHAPISCO_INTERNO", g.paredeLiquida, g.memoriaParede, a.id),
    ...item("EMBOCO_INTERNO", g.paredeLiquida, g.memoriaParede, a.id),
  ];
  const rev = areaRevestimentoParede(g, idx);
  const chaveRev = a.revestimentoParede.tipo === "porcelanato" ? "REVESTIMENTO_PORCELANATO_PAREDE" : "REVESTIMENTO_CERAMICO_PAREDE";
  saida.push(...item(chaveRev, rev.area, rev.memoria, a.id));
  const chavePiso = PISO[a.piso];
  if (chavePiso) {
    saida.push(...item("CONTRAPISO", g.area, memoriaArea(g), a.id), ...item(chavePiso, g.area, memoriaArea(g), a.id));
  }
  const chaveRodape = RODAPE[a.piso];
  if (chaveRodape && a.revestimentoParede.tipo === "nenhum" && !g.fracao.isZero()) {
    const portas = larguras(a.vaos.filter((v) => v.tipo === "porta"));
    const m = g.perimetroParede.minus(portas);
    saida.push(...item(chaveRodape, m, `${a.nome}: ${n(g.perimetroParede)} − ${n(portas)} (portas) = ${n(m)} m`, a.id));
  }
  const externas = larguras(a.vaos.filter((v) => v.tipo === "porta" && v.externa));
  saida.push(...item("SOLEIRA", externas, `${a.nome}: Σ larguras das portas externas = ${n(externas)} m`, a.id));
  const janelas = larguras(a.vaos.filter((v) => v.tipo === "janela"));
  saida.push(...item("PEITORIL", janelas, `${a.nome}: Σ larguras das janelas = ${n(janelas)} m`, a.id));
  return saida;
}

export const revestimentos: EtapaQuantitativos = (ctx) => {
  const fachada = areaFachada(ctx);
  return [
    ...ctx.geo.ambientes.flatMap((g) => revestimentosAmbiente(g, ctx.idx)),
    ...item("CHAPISCO_EXTERNO", fachada.area, `Fachada: ${fachada.memoria}`),
    ...item("REBOCO_EXTERNO", fachada.area, `Fachada: ${fachada.memoria}`),
  ];
};

const FORRO: Record<Exclude<TipoForro, "sem_forro">, string> = {
  pvc: "FORRO_PVC", gesso_placa: "FORRO_GESSO_PLACA", gesso_drywall: "FORRO_GESSO_DRYWALL", madeira: "FORRO_MADEIRA",
};

export const ehGesso = (f: TipoForro): boolean => f === "gesso_placa" || f === "gesso_drywall";

/** Há laje sobre o ambiente (para reboco/pintura de teto quando não há forro)? */
export function lajeSobre(ctx: Contexto, g: GeoAmbiente): boolean {
  return g.ambiente.pavimento < ctx.entrada.dadosGerais.pavimentos || temLajeCobertura(ctx);
}

export const forro: EtapaQuantitativos = (ctx) =>
  ctx.geo.ambientes.filter((g) => g.ambiente.coberto).flatMap((g) => {
    const a = g.ambiente;
    if (a.forro === "sem_forro") {
      if (!lajeSobre(ctx, g)) return [];
      const mem = `${memoriaArea(g)} (sem forro: teto na laje)`;
      return [...item("CHAPISCO_TETO", g.area, mem, a.id), ...item("REBOCO_TETO", g.area, mem, a.id)];
    }
    const saida = item(FORRO[a.forro], g.area, memoriaArea(g), a.id);
    if (ehGesso(a.forro)) {
      const mem = `${a.nome}: perímetro ${n(g.perimetro)} m`;
      saida.push(...item("TABICA_GESSO", g.perimetro, mem, a.id));
      if (ctx.padrao.sanca) saida.push(...item("SANCA_GESSO", g.perimetro, mem, a.id));
    }
    return saida;
  });

export const impermeabilizacao: EtapaQuantitativos = ({ geo, idx, tabelas }) =>
  geo.ambientes.filter((g) => g.molhada).flatMap((g) => {
    const a = g.ambiente;
    const area = g.area.plus(g.perimetro.times(idx.molhada_rodape));
    const saida = item("IMPERMEABILIZACAO_AREA_MOLHADA", area,
      `${a.nome}: ${n(g.area)} + ${n(g.perimetro)} × ${n(idx.molhada_rodape)} = ${n(area)} m²`, a.id);
    const boxes = tabelas.pontosHidraulicos[a.tipo].filter((p) => p === "chuveiro").length;
    if (boxes > 0) {
      const box = idx.box_altura.times(idx.box_perimetro).times(boxes);
      saida.push(...item("IMPERMEABILIZACAO_BOX", box, `${a.nome}: ${boxes} box × ${n(idx.box_altura)} × ${n(idx.box_perimetro)} = ${n(box)} m²`, a.id));
    }
    return saida;
  });
