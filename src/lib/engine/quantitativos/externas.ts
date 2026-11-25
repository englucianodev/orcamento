/** 7.2.16 Área gourmet, 7.2.17 Áreas externas, 7.2.18 Sistemas especiais e 7.2.19 Administração. */
import { prazoObra } from "../cronograma";
import { D, ZERO, type Dec } from "../decimal";
import { n } from "../geometria";
import { moradores } from "./hidrossanitaria";
import { item, type EtapaQuantitativos, type ItemQuantitativo } from "./tipos";

const CHURRASQUEIRA = {
  alvenaria: "CHURRASQUEIRA_ALVENARIA", pre_moldada: "CHURRASQUEIRA_PRE_MOLDADA", gas: "CHURRASQUEIRA_GAS",
} as const;

export const areaGourmet: EtapaQuantitativos = ({ entrada: e, idx }) => {
  const g = e.lazer.gourmet;
  const saida: ItemQuantitativo[] = [];
  if (g.churrasqueira !== "nenhuma") saida.push(...item(CHURRASQUEIRA[g.churrasqueira], new D(1), `Churrasqueira ${g.churrasqueira.replace("_", " ")}`));
  saida.push(...item("BANCADA_GOURMET", new D(g.bancadaMetros), `Bancada informada: ${n(new D(g.bancadaMetros))} m`));
  const temAmbiente = e.ambientes.some((a) => a.tipo === "area_gourmet");
  if (g.pia && !temAmbiente) {
    const mem = "Pia da área gourmet (sem ambiente gourmet lançado)";
    saida.push(...item("CUBA_GOURMET", new D(1), mem), ...item("PONTO_AGUA_FRIA", new D(1), mem), ...item("PONTO_ESGOTO", new D(1), mem));
  }
  if (g.fornoPizza) saida.push(...item("FORNO_PIZZA", new D(1), "Forno de pizza"));
  if (g.coifa) saida.push(...item("COIFA", new D(1), "Coifa"), ...item("PONTO_TUE", new D(1), "TUE da coifa"));
  if (saida.length > 0) saida.push(...item("PONTO_TOMADA_TUG", idx.gourmet_tug_extras, `TUG extras da área gourmet: ${n(idx.gourmet_tug_extras, 0)}`));
  return saida;
};

function muro({ entrada: e, idx }: Parameters<EtapaQuantitativos>[0]): ItemQuantitativo[] {
  const t = e.terreno;
  const m = t.muro;
  const lados: Array<[boolean, number, string]> = [
    [m.frente, t.largura, "frente"], [m.fundos, t.largura, "fundos"],
    [m.esquerda, t.profundidade, "esquerda"], [m.direita, t.profundidade, "direita"],
  ];
  const ativos = lados.filter(([ativo]) => ativo);
  if (ativos.length === 0 || m.altura <= 0) return [];
  const portao = m.frente && t.portao.existe ? new D(t.portao.largura) : ZERO;
  const comp = ativos.reduce((s: Dec, [, v]) => s.plus(v), ZERO).minus(portao);
  const h = new D(m.altura);
  const area = comp.times(h);
  const txtLados = ativos.map(([, v, nome]) => `${nome} ${n(new D(v))}`).join(" + ");
  const txtPortao = portao.isZero() ? "" : ` − portão ${n(portao)}`;
  const memComp = `${txtLados}${txtPortao} = ${n(comp)} m`;
  const b = idx.baldrame_largura;
  const hb = idx.baldrame_altura;
  const pilaretes = comp.div(idx.muro_pilarete_espacamento).ceil().plus(ativos.length);
  return [
    ...item("MURO_ESCAVACAO", comp.times(b.plus(idx.baldrame_folga_escavacao)).times(hb), `Fundação corrida: ${memComp} × ${n(b.plus(idx.baldrame_folga_escavacao))} × ${n(hb)}`),
    ...item("MURO_CONCRETO_FUNDACAO", comp.times(b).times(hb), `Fundação corrida: ${memComp} × ${n(b)} × ${n(hb)}`),
    ...item("MURO_ALVENARIA", area, `${memComp} × ${n(h)} = ${n(area)} m²`),
    ...item("MURO_PILARETE", pilaretes, `⌈${n(comp)} / ${n(idx.muro_pilarete_espacamento, 0)}⌉ + ${ativos.length} (cantos/extremos) = ${pilaretes.toFixed(0)}`),
    ...item("MURO_CHAPISCO_REBOCO", area.times(2), `${n(area)} m² × 2 faces = ${n(area.times(2))} m²`),
    ...item("MURO_PINTURA", area.times(2), `${n(area)} m² × 2 faces = ${n(area.times(2))} m²`),
  ];
}

export const areasExternas: EtapaQuantitativos = (ctx) => {
  const { entrada: e, idx, geo } = ctx;
  const t = e.terreno;
  const l = e.lazer;
  const saida = muro(ctx);
  if (t.calcadaPerimetral) {
    const calcada = geo.terreo.perimetroExterno.times(idx.calcada_largura);
    saida.push(...item("CALCADA_CONCRETO", calcada, `Perímetro externo ${n(geo.terreo.perimetroExterno)} × ${n(idx.calcada_largura)} = ${n(calcada)} m²`));
  }
  if (t.passeioPublico.existe) {
    const passeio = new D(t.largura).times(t.passeioPublico.largura);
    saida.push(...item("PASSEIO_PUBLICO", passeio, `Frente ${n(new D(t.largura))} × ${n(new D(t.passeioPublico.largura))} = ${n(passeio)} m²`));
  }
  if (t.portao.existe) {
    const area = new D(t.portao.largura).times(t.portao.altura);
    saida.push(...item("PORTAO_METALICO", area, `Portão ${t.portao.tipo} ${n(new D(t.portao.largura))}×${n(new D(t.portao.altura))} = ${n(area)} m²`));
    if (t.portao.automatizado) saida.push(...item("MOTOR_PORTAO", new D(1), `Motor para portão ${t.portao.tipo}`));
  }
  const m2 = (chave: string, v: number, nome: string) => item(chave, new D(v), `${nome}: ${n(new D(v))} m² (informado)`);
  saida.push(
    ...m2("DECK_MADEIRA", l.deckM2, "Deck"), ...m2("PERGOLADO", l.pergoladoM2, "Pergolado"),
    ...m2("PAISAGISMO_GRAMA", l.paisagismoM2, "Paisagismo"), ...m2("QUADRA_POLIESPORTIVA", l.quadraM2, "Quadra"),
  );
  if (l.sauna) saida.push(...item("SAUNA", new D(1), "Sauna"));
  if (l.playground) saida.push(...item("PLAYGROUND", new D(1), "Playground"));
  if (l.canil) saida.push(...item("CANIL", new D(1), "Canil"));
  return saida;
};

const COMODOS_REDE = new Set(["quarto", "suite", "sala_estar", "escritorio", "home_theater"]);

export const sistemasEspeciais: EtapaQuantitativos = (ctx) => {
  const { entrada: e, idx } = ctx;
  const i = e.instalacoes;
  const saida = item("SISTEMA_FOTOVOLTAICO", new D(i.solarKwp), `${n(new D(i.solarKwp))} kWp (informado)`);
  if (i.aguaQuente === "solar") {
    const mor = moradores(ctx);
    const litros = new D(mor.quantidade).times(idx.aquecedor_solar_litros_pessoa);
    saida.push(...item("AQUECEDOR_SOLAR_BOILER", new D(1), `${mor.memoria} × ${n(idx.aquecedor_solar_litros_pessoa, 0)} L = boiler de ${n(litros, 0)} L`));
  }
  if (i.aguaQuente === "gas") saida.push(...item("AQUECEDOR_GAS", new D(1), "Aquecedor de passagem a gás"));
  if (i.spda) saida.push(...item("SPDA", new D(1), "SPDA (para-raios)"));
  if (i.automacao) saida.push(...item("AUTOMACAO", new D(1), "Automação residencial"));
  saida.push(...item("CFTV_CAMERA", new D(i.cftvCameras), `${i.cftvCameras} câmera(s)`));
  if (i.redeLogica) {
    const pontos = e.ambientes.filter((a) => COMODOS_REDE.has(a.tipo)).length;
    saida.push(...item("PONTO_REDE_LOGICA", new D(pontos), `1 ponto por quarto, sala, escritório e home theater = ${pontos}`));
  }
  saida.push(...item("PONTO_AR_CONDICIONADO", new D(i.pontosAr), `${i.pontosAr} ponto(s) de ar-condicionado`));
  return saida;
};

export const administracao: EtapaQuantitativos = ({ entrada: e, idx, geo, tabelas }) => {
  const prazo = prazoObra(geo.areaConstruida, e.dadosGerais.padrao, idx, tabelas);
  const meses = new D(prazo.meses);
  return [
    ...item("ADM_ENGENHEIRO", meses.times(idx.adm_horas_engenheiro_mes), `${prazo.memoria} × ${n(idx.adm_horas_engenheiro_mes, 0)} h/mês`),
    ...item("ADM_MESTRE_OBRAS", meses.times(idx.adm_horas_mestre_mes), `${prazo.memoria} × ${n(idx.adm_horas_mestre_mes, 0)} h/mês`),
    ...item("LIMPEZA_FINAL", geo.areaConstruida, `Área construída ${n(geo.areaConstruida)} m²`),
    ...item("PROJETOS_TAXAS", idx.projetos_taxas_pct, `${n(idx.projetos_taxas_pct)}% do custo direto (índice)`),
  ];
};
