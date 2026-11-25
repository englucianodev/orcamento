/**
 * Geometria por ambiente e por pavimento (seção 7.1). Funções puras; toda medida em Decimal.
 */
import { D, ZERO, formatarBr, soma, type Dec } from "./decimal";
import type { Ambiente, Entrada, Vao } from "./entrada.schema";
import type { Indices } from "./indices";
import { AREAS_MOLHADAS } from "./tabelas";

export const n = (v: Dec, casas = 2): string => formatarBr(v, casas);

export interface GeoAmbiente {
  ambiente: Ambiente;
  area: Dec;
  perimetro: Dec;
  perimetroEstimado: boolean;
  altura: Dec;
  /** fração do perímetro com parede (0 a 1) */
  fracao: Dec;
  /** perímetro com parede = P × fração */
  perimetroParede: Dec;
  paredeBruta: Dec;
  vaosArea: Dec;
  vaosDescontados: Dec;
  paredeLiquida: Dec;
  molhada: boolean;
  memoriaParede: string;
}

export function areaVao(v: Vao): Dec {
  return new D(v.largura).times(v.altura).times(v.quantidade);
}

/** Vão descontável: área unitária maior que o índice (0 = todos). */
export function vaoDescontavel(v: Vao, idx: Indices): boolean {
  return new D(v.largura).times(v.altura).gt(idx.desconto_vaos_area_minima);
}

export function alturaAmbiente(a: Ambiente): Dec {
  if (!a.peDireitoDuplo) return new D(a.peDireito);
  return a.alturaLivre !== null ? new D(a.alturaLivre) : new D(a.peDireito).times(2);
}

function fracaoParedes(a: Ambiente): Dec {
  if (a.paredes.modo === "nenhuma") return ZERO;
  if (a.paredes.modo === "parcial") return new D(a.paredes.percentual).div(100);
  return new D(1);
}

export function ehMolhada(a: Ambiente): boolean {
  return a.areaMolhada ?? AREAS_MOLHADAS.has(a.tipo);
}

export function geometriaAmbiente(a: Ambiente, idx: Indices): GeoAmbiente {
  const retangular = a.largura !== null && a.comprimento !== null;
  const area = retangular ? new D(a.largura!).times(a.comprimento!) : new D(a.areaManual ?? 0);
  const perimetroEstimado = !retangular && a.perimetroManual === null;
  const perimetro = retangular
    ? new D(a.largura!).plus(a.comprimento!).times(2)
    : a.perimetroManual !== null ? new D(a.perimetroManual) : area.sqrt().times(4);
  const altura = alturaAmbiente(a);
  const fracao = fracaoParedes(a);
  const perimetroParede = perimetro.times(fracao);
  const paredeBruta = perimetroParede.times(altura);
  const vaosArea = soma(a.vaos.map(areaVao));
  const desc = soma(a.vaos.filter((v) => vaoDescontavel(v, idx)).map(areaVao));
  const vaosDescontados = fracao.isZero() ? ZERO : D.min(desc, paredeBruta);
  const paredeLiquida = paredeBruta.minus(vaosDescontados);

  const txtP = retangular
    ? `(${n(new D(a.largura!))}+${n(new D(a.comprimento!))})×2`
    : perimetroEstimado ? `${n(perimetro)} (perímetro estimado: 4×√${n(area)})` : n(perimetro);
  const txtFr = fracao.eq(1) ? "" : `×${n(fracao.times(100), 0)}%`;
  const txtV = vaosDescontados.isZero() ? "" : ` − ${n(vaosDescontados)}`;
  const memoriaParede = `${a.nome}: ${txtP}×${n(altura)}${txtFr}${txtV} = ${n(paredeLiquida)} m²`;

  return {
    ambiente: a, area, perimetro, perimetroEstimado, altura, fracao, perimetroParede, paredeBruta,
    vaosArea, vaosDescontados, paredeLiquida, molhada: ehMolhada(a), memoriaParede,
  };
}

export interface GeoPavimento {
  numero: number;
  ambientes: GeoAmbiente[];
  somaAreas: Dec;
  projecao: Dec;
  largura: Dec;
  comprimento: Dec;
  projecaoInformada: boolean;
  perimetroExterno: Dec;
  comprimentoAlvenaria: Dec;
  peDireitoMedio: Dec;
  vaosDescontados: Dec;
  memoriaProjecao: string;
}

function retanguloEstimado(area: Dec, proporcao: Dec): { largura: Dec; comprimento: Dec } {
  if (area.isZero()) return { largura: ZERO, comprimento: ZERO };
  const largura = area.div(proporcao).sqrt();
  return { largura, comprimento: largura.times(proporcao) };
}

function geometriaPavimento(numero: number, geos: GeoAmbiente[], e: Entrada, idx: Indices): GeoPavimento {
  const cobertos = geos.filter((g) => g.ambiente.coberto);
  const somaAreas = soma(cobertos.map((g) => g.area));
  const c = e.construcao;
  const informada = numero === 1 && c.projecaoLargura !== null && c.projecaoComprimento !== null;
  let largura: Dec;
  let comprimento: Dec;
  let projecao: Dec;
  let memoriaProjecao: string;
  if (informada) {
    largura = new D(c.projecaoLargura!);
    comprimento = new D(c.projecaoComprimento!);
    projecao = largura.times(comprimento);
    memoriaProjecao = `Pavimento ${numero}: projeção informada ${n(largura)}×${n(comprimento)} = ${n(projecao)} m²`;
  } else {
    projecao = somaAreas.times(new D(1).plus(idx.k_paredes));
    ({ largura, comprimento } = retanguloEstimado(projecao, idx.proporcao_projecao));
    memoriaProjecao = `Pavimento ${numero}: Σ áreas ${n(somaAreas)} × (1 + ${n(idx.k_paredes)}) = ${n(projecao)} m²; retângulo 1:${n(idx.proporcao_projecao, 1)} → ${n(largura)}×${n(comprimento)}`;
  }
  const perimetroExterno = largura.plus(comprimento).times(2);
  const somaPerimetros = soma(geos.map((g) => g.perimetroParede));
  const comprimentoAlvenaria = somaPerimetros.isZero() ? ZERO : somaPerimetros.plus(perimetroExterno).div(2);
  const pesoAltura = soma(geos.map((g) => g.perimetroParede.times(g.altura)));
  const peDireitoMedio = somaPerimetros.isZero() ? new D(2.8) : pesoAltura.div(somaPerimetros);
  return {
    numero, ambientes: geos, somaAreas, projecao, largura, comprimento, projecaoInformada: informada,
    perimetroExterno, comprimentoAlvenaria, peDireitoMedio,
    vaosDescontados: soma(geos.map((g) => g.vaosDescontados)), memoriaProjecao,
  };
}

export interface GeometriaObra {
  ambientes: GeoAmbiente[];
  pavimentos: GeoPavimento[];
  terreo: GeoPavimento;
  areaConstruida: Dec;
  /** altura da fachada: soma dos pés-direitos médios dos pavimentos */
  alturaFachada: Dec;
  /** vãos na fachada: janelas e portas externas descontáveis */
  vaosExternos: Dec;
}

export function geometriaObra(e: Entrada, idx: Indices): GeometriaObra {
  const ambientes = e.ambientes.map((a) => geometriaAmbiente(a, idx));
  const pavimentos: GeoPavimento[] = [];
  for (let p = 1; p <= e.dadosGerais.pavimentos; p++) {
    pavimentos.push(geometriaPavimento(p, ambientes.filter((g) => g.ambiente.pavimento === p), e, idx));
  }
  const vaosExternos = soma(
    e.ambientes.flatMap((a) => a.vaos)
      .filter((v) => (v.tipo === "janela" || v.externa) && vaoDescontavel(v, idx))
      .map(areaVao),
  );
  return {
    ambientes, pavimentos, terreo: pavimentos[0]!,
    areaConstruida: soma(pavimentos.map((p) => p.projecao)),
    alturaFachada: soma(pavimentos.map((p) => p.peDireitoMedio)),
    vaosExternos,
  };
}
