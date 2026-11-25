/** 7.2.10 Esquadrias e 7.2.14 Pintura. */
import { D, ZERO, soma } from "../decimal";
import type { Vao } from "../entrada.schema";
import { areaVao, n, type GeoAmbiente } from "../geometria";
import { areaFachada, areaRevestimentoParede, ehGesso, lajeSobre, memoriaArea } from "./revestimentos";
import { item, type Contexto, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

const PORTA_UN: Partial<Record<Vao["material"], string>> = {
  madeira_semioca: "PORTA_MADEIRA_SEMIOCA", madeira_kit_pronta: "PORTA_MADEIRA_KIT_PRONTA", madeira_macica: "PORTA_MADEIRA_MACICA",
};
const PORTA_M2: Partial<Record<Vao["material"], string>> = {
  aluminio: "PORTA_ALUMINIO", vidro_temperado: "PORTA_VIDRO_TEMPERADO", pvc: "PORTA_PVC",
};
const JANELA: Partial<Record<Vao["material"], string>> = {
  aluminio: "JANELA_ALUMINIO", aluminio_linha_25: "JANELA_ALUMINIO_LINHA_25", aluminio_linha_gold: "JANELA_ALUMINIO_LINHA_GOLD",
  pvc: "JANELA_PVC", madeira: "JANELA_MADEIRA", vidro_temperado: "JANELA_VIDRO_TEMPERADO",
  sob_medida_vidro_duplo: "JANELA_SOB_MEDIDA_VIDRO_DUPLO",
};

const descricaoVao = (nome: string, v: Vao): string =>
  `${nome}: ${v.quantidade} × ${v.tipo} ${n(new D(v.largura))}×${n(new D(v.altura))} (${v.material.replaceAll("_", " ")})`;

function itensVao(nome: string, ambienteId: string, v: Vao): ItemQuantitativo[] {
  const qtd = new D(v.quantidade);
  const area = areaVao(v);
  const mem = descricaoVao(nome, v);
  const memArea = `${mem} = ${n(area)} m²`;
  if (v.tipo === "porta") {
    const un = PORTA_UN[v.material];
    const m2 = PORTA_M2[v.material] ?? "PORTA_ALUMINIO";
    return [
      ...(un ? item(un, qtd, mem, ambienteId) : item(m2, area, memArea, ambienteId)),
      ...item("FECHADURA", qtd, mem, ambienteId),
    ];
  }
  const chave = JANELA[v.material] ?? "JANELA_ALUMINIO";
  const saida = item(chave, area, memArea, ambienteId);
  if (v.material === "madeira") saida.push(...item("VIDRO_JANELA", area, memArea, ambienteId));
  return saida;
}

export const esquadrias: EtapaQuantitativos = ({ entrada: e }) =>
  e.ambientes.flatMap((a) => a.vaos.flatMap((v) => itensVao(a.nome, a.id, v)));

const TINTA = {
  latex_pva: { tinta: "PINTURA_LATEX_PVA", massa: null },
  acrilica_massa_pva: { tinta: "PINTURA_ACRILICA", massa: "MASSA_CORRIDA_PVA" },
  acrilica_massa_acrilica: { tinta: "PINTURA_ACRILICA", massa: "MASSA_ACRILICA" },
  acrilica_premium: { tinta: "PINTURA_ACRILICA_PREMIUM", massa: "MASSA_ACRILICA" },
} as const;

function pinturaAmbiente(ctx: Contexto, g: GeoAmbiente): ItemQuantitativo[] {
  const a = g.ambiente;
  const saida: ItemQuantitativo[] = [];
  if (a.pintura !== "nenhuma") {
    const ceramica = areaRevestimentoParede(g, ctx.idx).area;
    const area = D.max(ZERO, g.paredeLiquida.minus(ceramica));
    const txtCer = ceramica.isZero() ? "" : ` − revestimento ${n(ceramica)}`;
    const mem = `${a.nome}: parede líquida ${n(g.paredeLiquida)}${txtCer} = ${n(area)} m²`;
    const t = TINTA[a.pintura];
    saida.push(...item("SELADOR_PAREDE", area, mem, a.id), ...item(t.tinta, area, mem, a.id));
    if (t.massa) saida.push(...item(t.massa, area, mem, a.id));
  }
  const tetoPintavel = a.coberto && ((a.forro === "sem_forro" && lajeSobre(ctx, g)) || ehGesso(a.forro));
  if (tetoPintavel) saida.push(...item("PINTURA_TETO", g.area, memoriaArea(g), a.id));
  return saida;
}

export const pintura: EtapaQuantitativos = (ctx) => {
  const e = ctx.entrada;
  const fachada = areaFachada(ctx);
  const vaosMadeira = e.ambientes.flatMap((a) => a.vaos)
    .filter((v) => v.material === "madeira_semioca" || v.material === "madeira_macica" || v.material === "madeira");
  const madeira = soma(vaosMadeira.map(areaVao)).times(2);
  const p = e.terreno.portao;
  const portao = p.existe ? new D(p.largura).times(p.altura).times(2) : ZERO;
  return [
    ...ctx.geo.ambientes.flatMap((g) => pinturaAmbiente(ctx, g)),
    ...item("PINTURA_FACHADA", fachada.area, `Fachada: ${fachada.memoria}`),
    ...item("PINTURA_ESMALTE_MADEIRA", madeira, `${vaosMadeira.length} esquadria(s) de madeira × 2 faces = ${n(madeira)} m²`),
    ...item("PINTURA_ESMALTE_METAL", portao, `Portão ${n(new D(p.largura))}×${n(new D(p.altura))} × 2 faces = ${n(portao)} m²`),
  ];
};
