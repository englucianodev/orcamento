/** 7.2.1 Serviços preliminares e 7.2.2 Terraplenagem. */
import { D } from "../decimal";
import { n } from "../geometria";
import { item, type EtapaQuantitativos } from "./tipos";

const LIMPEZA = {
  leve: "LIMPEZA_TERRENO_VEGETACAO_LEVE",
  media: "LIMPEZA_TERRENO_VEGETACAO_MEDIA",
  densa: "LIMPEZA_TERRENO_VEGETACAO_DENSA",
} as const;

export const preliminares: EtapaQuantitativos = ({ entrada: e, idx, geo }) => {
  const t = e.terreno;
  const areaTerreno = new D(t.largura).times(t.profundidade);
  const tapume = new D(t.largura).times(idx.tapume_altura);
  const barracaoPct = geo.areaConstruida.times(idx.barracao_pct);
  const barracao = D.max(barracaoPct, idx.barracao_minimo);
  return [
    ...item(LIMPEZA[t.vegetacao], areaTerreno, `Terreno ${n(new D(t.largura))}×${n(new D(t.profundidade))} = ${n(areaTerreno)} m² (vegetação ${t.vegetacao})`),
    ...item("LOCACAO_OBRA", geo.terreo.projecao, `Projeção do térreo — ${geo.terreo.memoriaProjecao}`),
    ...item("TAPUME", tapume, `Frente ${n(new D(t.largura))} × ${n(idx.tapume_altura)} = ${n(tapume)} m²`),
    ...item("BARRACAO_OBRA", barracao, `max(${n(idx.barracao_minimo)}; ${n(idx.barracao_pct.times(100), 1)}% × ${n(geo.areaConstruida)}) = ${n(barracao)} m²`),
    ...item("PLACA_OBRA", idx.placa_obra_area, `Placa de obra: ${n(idx.placa_obra_area)} m² (índice)`),
    ...item("LIGACAO_PROVISORIA_AGUA", new D(1), "1 ligação provisória de água"),
    ...item("LIGACAO_PROVISORIA_ENERGIA", new D(1), "1 ligação provisória de energia"),
  ];
};

/** Platô: corte e aterro = projeção × desnível / 2. Volume acima do limite → composições SICRO. */
export const terraplenagem: EtapaQuantitativos = ({ entrada: e, idx, geo }) => {
  const desnivel = new D(e.terreno.desnivel);
  if (desnivel.isZero()) return [];
  const proj = geo.terreo.projecao;
  const corte = proj.times(desnivel).div(2);
  const aterro = corte;
  const total = corte.plus(aterro);
  const botaFora = corte.times(idx.empolamento);
  const memCorte = `Projeção ${n(proj)} × desnível ${n(desnivel)} / 2 = ${n(corte)} m³`;
  const memBota = `Corte ${n(corte)} × empolamento ${n(idx.empolamento)} = ${n(botaFora)} m³`;
  if (total.gt(idx.terraplenagem_limite_sicro)) {
    const informada = e.terreno.dmtBotaForaKm;
    const dmt = informada !== null ? new D(informada) : idx.dmt_padrao_km;
    const momento = botaFora.times(dmt);
    const origemDmt = informada !== null ? "informada" : "padrão do índice";
    const aviso = `volume total ${n(total)} m³ > ${n(idx.terraplenagem_limite_sicro, 0)} m³ → SICRO`;
    return [
      ...item("ESCAVACAO_CARGA_SICRO", corte, `${memCorte} (${aviso})`),
      ...item("COMPACTACAO_ATERRO_SICRO", aterro, `Aterro = corte = ${n(aterro)} m³`),
      ...item("TRANSPORTE_BOTA_FORA_SICRO", momento, `${memBota} × DMT ${n(dmt)} km (${origemDmt}) = ${n(momento)} m³×km`),
    ];
  }
  return [
    ...item("CORTE_TERRENO_SINAPI", corte, memCorte),
    ...item("ATERRO_COMPACTADO_SINAPI", aterro, `Aterro = corte = ${n(aterro)} m³`),
    ...item("CARGA_TRANSPORTE_BOTA_FORA_SINAPI", botaFora, memBota),
  ];
};
