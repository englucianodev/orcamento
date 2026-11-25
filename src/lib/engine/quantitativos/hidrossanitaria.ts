/** 7.2.12 Instalações hidrossanitárias e 7.2.13 Louças, metais e bancadas. */
import { D, ZERO, type Dec } from "../decimal";
import { n } from "../geometria";
import type { PontoHidraulico } from "../tabelas";
import { item, type Contexto, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

const AGUA: ReadonlySet<PontoHidraulico> = new Set(["vaso", "lavatorio", "chuveiro", "pia", "filtro", "maquina_louca", "tanque", "maquina_lavar"]);
const ESGOTO: ReadonlySet<PontoHidraulico> = new Set(["vaso", "lavatorio", "ralo", "pia", "maquina_louca", "tanque", "maquina_lavar"]);
const QUENTE: ReadonlySet<PontoHidraulico> = new Set(["chuveiro", "lavatorio", "pia"]);

export function escolherReservatorio(litros: number, tamanhos: readonly number[]): { litros: number; quantidade: number } {
  const ordenados = [...tamanhos].sort((a, b) => a - b);
  const cabe = ordenados.find((t) => t >= litros);
  if (cabe !== undefined) return { litros: cabe, quantidade: 1 };
  const maior = ordenados[ordenados.length - 1] ?? 1000;
  return { litros: maior, quantidade: Math.ceil(litros / maior) };
}

export function moradores(ctx: Contexto): { quantidade: number; memoria: string } {
  const informado = ctx.entrada.instalacoes.moradores;
  if (informado !== null) return { quantidade: informado, memoria: `${informado} moradores (informado)` };
  const quartos = ctx.entrada.ambientes.filter((a) => a.tipo === "quarto" || a.tipo === "suite").length;
  const q = Math.max(2, quartos * ctx.idx.moradores_por_quarto.toNumber());
  return { quantidade: q, memoria: `${quartos} quarto(s) × ${n(ctx.idx.moradores_por_quarto, 0)} = ${q} moradores` };
}

const temAguaQuenteEncanada = (ctx: Contexto): boolean =>
  ctx.entrada.instalacoes.aguaQuente === "gas" || ctx.entrada.instalacoes.aguaQuente === "solar";

function contar(pontos: readonly PontoHidraulico[], grupo: ReadonlySet<PontoHidraulico>): number {
  return pontos.filter((p) => grupo.has(p)).length;
}

function reservacao(ctx: Contexto): ItemQuantitativo[] {
  const { idx, entrada: e, tabelas } = ctx;
  const mor = moradores(ctx);
  const informado = e.instalacoes.reservatorioLitros;
  const litros = informado ?? new D(mor.quantidade).times(idx.consumo_por_pessoa).times(idx.reservatorio_dias).toNumber();
  const r = escolherReservatorio(litros, tabelas.reservatoriosComerciais);
  const mem = informado !== null
    ? `${litros} L (informado) → ${r.quantidade} × ${r.litros} L`
    : `${mor.memoria} × ${n(idx.consumo_por_pessoa, 0)} L × ${n(idx.reservatorio_dias, 0)} dias = ${litros} L → ${r.quantidade} × ${r.litros} L`;
  const saida = item(`RESERVATORIO_${r.litros}L`, new D(r.quantidade), mem);
  if (e.instalacoes.cisternaLitros > 0) {
    const m3 = new D(e.instalacoes.cisternaLitros).div(1000);
    saida.push(...item("CISTERNA", m3, `${e.instalacoes.cisternaLitros} L = ${n(m3)} m³`));
  }
  if (e.instalacoes.esgoto === "fossa_sumidouro") {
    saida.push(
      ...item("FOSSA_SEPTICA", new D(1), `Sem rede pública: fossa para ${mor.memoria}`),
      ...item("SUMIDOURO", new D(1), `Sem rede pública: sumidouro para ${mor.memoria}`),
    );
  }
  return saida;
}

export const hidrossanitaria: EtapaQuantitativos = (ctx) => {
  const { idx, geo, tabelas } = ctx;
  const saida: ItemQuantitativo[] = [];
  let agua = 0;
  let esgoto = 0;
  let quente = 0;
  let gordura = 0;
  for (const g of geo.ambientes) {
    const a = g.ambiente;
    const pontos = tabelas.pontosHidraulicos[a.tipo];
    if (pontos.length === 0) continue;
    const pa = contar(pontos, AGUA);
    const pe = contar(pontos, ESGOTO);
    const pq = temAguaQuenteEncanada(ctx) ? contar(pontos, QUENTE) : 0;
    agua += pa;
    esgoto += pe;
    quente += pq;
    const mem = `${a.nome}: ${pontos.join(", ").replaceAll("_", " ")}`;
    saida.push(
      ...item("PONTO_AGUA_FRIA", new D(pa), mem, a.id),
      ...item("PONTO_ESGOTO", new D(pe), mem, a.id),
      ...item("PONTO_AGUA_QUENTE", new D(pq), mem, a.id),
      ...item("RALO_SIFONADO", new D(contar(pontos, new Set(["ralo"]))), mem, a.id),
    );
    if (a.tipo === "cozinha" || a.tipo === "area_gourmet") gordura += 1;
    else if (pe > 0) saida.push(...item("CAIXA_SIFONADA", new D(1), `${a.nome}: 1 caixa sifonada`, a.id));
  }
  const rede = geo.terreo.perimetroExterno.times(idx.rede_externa_fator);
  const inspecao = D.max(1, rede.div(idx.caixa_inspecao_espacamento).ceil());
  const tubo = (pontos: number, porPonto: Dec): Dec => new D(pontos).times(porPonto);
  saida.push(
    ...item("TUBO_AGUA_FRIA", tubo(agua, idx.agua_fria_por_ponto), `${agua} pontos × ${n(idx.agua_fria_por_ponto, 0)} m`),
    ...item("TUBO_ESGOTO", tubo(esgoto, idx.esgoto_por_ponto), `${esgoto} pontos × ${n(idx.esgoto_por_ponto, 0)} m`),
    ...item("TUBO_AGUA_QUENTE", tubo(quente, idx.agua_quente_por_ponto), `${quente} pontos × ${n(idx.agua_quente_por_ponto, 0)} m`),
    ...item("CAIXA_GORDURA", new D(gordura), `${gordura} cozinha(s)/área(s) gourmet`),
    ...item("CAIXA_INSPECAO", inspecao, `Rede externa ${n(geo.terreo.perimetroExterno)} × ${n(idx.rede_externa_fator, 1)} = ${n(rede)} m → ⌈${n(rede)} / ${n(idx.caixa_inspecao_espacamento, 0)}⌉ = ${inspecao.toFixed(0)}`),
    ...reservacao(ctx),
  );
  return saida;
};

const LOUCAS: Readonly<Record<PontoHidraulico, readonly string[]>> = {
  vaso: ["BACIA_SANITARIA"], lavatorio: ["LAVATORIO", "TORNEIRA_LAVATORIO"], chuveiro: [], ralo: [],
  pia: ["CUBA_COZINHA", "TORNEIRA_COZINHA"], filtro: ["TORNEIRA_FILTRO"], maquina_louca: ["TORNEIRA_MAQUINA"],
  tanque: ["TANQUE", "TORNEIRA_TANQUE"], maquina_lavar: ["TORNEIRA_MAQUINA"],
};

export const loucasMetais: EtapaQuantitativos = (ctx) => {
  const { geo, tabelas, idx, padrao } = ctx;
  const chuveiro = temAguaQuenteEncanada(ctx) ? "DUCHA" : "CHUVEIRO_ELETRICO";
  return geo.ambientes.flatMap((g) => {
    const a = g.ambiente;
    const pontos = tabelas.pontosHidraulicos[a.tipo];
    const mem = `${a.nome}: ${padrao.loucasMetais.toLowerCase()}`;
    const saida: ItemQuantitativo[] = [];
    let bancada: Dec = ZERO;
    for (const p of pontos) {
      for (const chave of LOUCAS[p]) saida.push(...item(chave, new D(1), mem, a.id));
      if (p === "chuveiro") saida.push(...item(chuveiro, new D(1), mem, a.id));
      if (p === "lavatorio") bancada = bancada.plus(idx.bancada_banheiro);
      if (p === "pia") bancada = bancada.plus(idx.bancada_cozinha);
    }
    saida.push(...item("BANCADA_PEDRA", bancada, `${a.nome}: ${padrao.bancadas.toLowerCase()}, ${n(bancada)} m² (índice por lavatório/pia)`, a.id));
    if (a.tipo === "banheiro" || a.tipo === "lavabo") saida.push(...item("ACESSORIOS_BANHEIRO", new D(1), mem, a.id));
    return saida;
  });
};
