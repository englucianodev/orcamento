/** 7.2.11 Instalações elétricas (simplificação baseada na NBR 5410). */
import { D, ZERO, soma, type Dec } from "../decimal";
import { n, type GeoAmbiente } from "../geometria";
import { item, type Contexto, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

export interface PontosEletricos {
  luz: Dec;
  tug: Dec;
  tue: Dec;
  memoriaLuz: string;
  memoriaTug: string;
  memoriaTue: string;
}

const chuveiroEletrico = (ctx: Contexto): boolean =>
  ctx.entrada.instalacoes.aguaQuente === "eletrica" || ctx.entrada.instalacoes.aguaQuente === "nenhuma";

export function pontosEletricos(ctx: Contexto, g: GeoAmbiente): PontosEletricos {
  const { idx, padrao, tabelas } = ctx;
  const a = g.ambiente;
  const base = D.max(1, g.area.div(idx.luz_area_por_ponto).toDecimalPlaces(0, D.ROUND_HALF_UP));
  const mult = new D(padrao.multiplicadorPontos);
  const luz = D.max(1, base.times(mult).toDecimalPlaces(0, D.ROUND_HALF_UP));
  const memoriaLuz = `${a.nome}: max(1; arred(${n(g.area)} / ${n(idx.luz_area_por_ponto, 0)})) × ${n(mult, 1)} = ${luz.toFixed(0)}`;

  const regra = tabelas.regraTug[a.tipo];
  let tug: Dec;
  let memoriaTug: string;
  if (regra === "um") {
    tug = new D(1);
    memoriaTug = `${a.nome}: 1 ponto`;
  } else {
    const div = regra === "seco" ? idx.tug_perimetro_seco : idx.tug_perimetro_molhado;
    tug = g.perimetro.div(div).ceil();
    memoriaTug = `${a.nome}: ⌈${n(g.perimetro)} / ${n(div, 1)}⌉ = ${tug.toFixed(0)}`;
  }

  const pontos = tabelas.pontosHidraulicos[a.tipo];
  const tues: string[] = [];
  if (chuveiroEletrico(ctx)) tues.push(...pontos.filter((p) => p === "chuveiro"));
  tues.push(...pontos.filter((p) => p === "maquina_lavar" || p === "maquina_louca"));
  if (a.tipo === "cozinha") tues.push("forno");
  return {
    luz, tug, tue: new D(tues.length), memoriaLuz, memoriaTug,
    memoriaTue: `${a.nome}: ${tues.map((t) => t.replace("_", " ")).join(", ")}`,
  };
}

export const eletrica: EtapaQuantitativos = (ctx) => {
  const { idx, entrada: e, geo } = ctx;
  const saida: ItemQuantitativo[] = [];
  let total: Dec = ZERO;
  for (const g of geo.ambientes) {
    const p = pontosEletricos(ctx, g);
    total = total.plus(p.luz).plus(p.tug).plus(p.tue);
    saida.push(
      ...item("PONTO_LUZ", p.luz, p.memoriaLuz, g.ambiente.id),
      ...item("PONTO_TOMADA_TUG", p.tug, p.memoriaTug, g.ambiente.id),
      ...item("PONTO_TUE", p.tue, p.memoriaTue, g.ambiente.id),
    );
  }
  const ar = new D(e.instalacoes.pontosAr);
  saida.push(...item("PONTO_TUE", ar, `${ar.toFixed(0)} ponto(s) de ar-condicionado`));
  total = total.plus(ar);
  const quadros = new D(e.dadosGerais.pavimentos);
  const eletroduto = total.times(idx.eletroduto_por_ponto);
  const cabo = total.times(idx.cabo_por_ponto);
  const totalTxt = `${total.toFixed(0)} pontos`;
  saida.push(
    ...item("QUADRO_DISTRIBUICAO", quadros, `1 quadro por pavimento × ${quadros.toFixed(0)}`),
    ...item("ELETRODUTO", eletroduto, `${totalTxt} × ${n(idx.eletroduto_por_ponto, 0)} m = ${n(eletroduto)} m`),
    ...item("CABO_ELETRICO", cabo, `${totalTxt} × ${n(idx.cabo_por_ponto, 0)} m = ${n(cabo)} m`),
    ...item("ENTRADA_ENERGIA", new D(1), "1 entrada de energia (padrão da concessionária)"),
  );
  return saida;
};

/** Soma dos pontos (para conferência no resumo do assistente). */
export function totalPontosEletricos(ctx: Contexto): Dec {
  return soma(ctx.geo.ambientes.map((g) => {
    const p = pontosEletricos(ctx, g);
    return p.luz.plus(p.tug).plus(p.tue);
  }));
}
