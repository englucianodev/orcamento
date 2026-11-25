import { describe, expect, it } from "vitest";
import { D } from "@/lib/engine/decimal";
import { montarModeloRelatorio } from "@/lib/relatorios/modelo";
import { dadosFixture, FAIXAS, FECHAMENTO_SINAPI } from "./relatorios-fixture";

const somaN = (valores: ReadonlyArray<{ n: string | null }>) => valores.reduce((s, v) => s.plus(v.n ?? "0"), new D(0));

describe("montarModeloRelatorio", () => {
  const dados = dadosFixture();
  const modelo = montarModeloRelatorio(dados, { dataEmissao: "25/11/2026", composicoes: { sinapi: FECHAMENTO_SINAPI }, faixas: FAIXAS });

  it("agrupa a sintética por etapa na ordem do catálogo, com subtotais que fecham o total", () => {
    const etapas = modelo.sintetica.etapas;
    expect(etapas.map((e) => e.id)).toEqual(["preliminares", "alvenaria", "revestimentos", "pintura", "administracao"]);
    expect(etapas.find((e) => e.id === "revestimentos")!.itens.map((i) => i.id)).toEqual(["i3", "i4"]);
    expect(somaN(etapas.map((e) => e.subtotal)).toFixed(2)).toBe(modelo.sintetica.total.n);
    expect(modelo.sintetica.total.n).toBe(dados.resultado.total.toFixed(2));
    expect(modelo.sintetica.custoDireto.br).toBe("6.195,00");
  });

  it("monta a coluna Fonte/Código e marca itens sem composição", () => {
    const itens = modelo.sintetica.etapas.flatMap((e) => e.itens);
    const porId = new Map(itens.map((i) => [i.id, i]));
    expect(porId.get("i1")!.fonteCodigo).toBe("SINAPI 1001");
    expect(porId.get("i3")!.fonteCodigo).toBe("SICRO 3003");
    expect(porId.get("i4")!.fonteCodigo).toBe("PRÓPRIA X1");
    expect(porId.get("i5")!.fonteCodigo).toBe("—");
    expect(porId.get("i4")!.semComposicao).toBe(true);
    expect(porId.get("i4")!.total).toEqual({ br: "—", n: null });
    expect(porId.get("i1")!.custoTotal.br).toBe("1.000,00");
    expect(porId.get("i5")!.percentual).toBe(true);
    expect(modelo.sintetica.semComposicao).toBe(1);
    expect(modelo.avisos.some((a) => a.includes("1 item sem composição"))).toBe(true);
  });

  it("classifica a curva ABC (80% / 95%) e fecha em 100%", () => {
    const abc = modelo.abc;
    expect(abc.linhas.map((l) => l.numero)).toEqual(["5.1", "1.1", "7.1", "19.1", "14.1"]);
    expect(abc.linhas.map((l) => l.classe)).toEqual(["A", "B", "B", "C", "C"]);
    expect(abc.linhas.at(-1)!.acumulado.br).toBe("100,00%");
    expect(somaN(abc.classes.map((c) => c.total)).toFixed(2)).toBe(modelo.sintetica.total.n);
    expect(abc.classes.map((c) => c.itens)).toEqual([1, 2, 2]);
  });

  it("distribui o cronograma: cada etapa fecha seu total e os meses somam o orçamento", () => {
    const c = modelo.cronograma;
    expect(c.meses).toEqual(["Mês 1", "Mês 2", "Mês 3"]);
    for (const l of c.linhas) expect(somaN(l.valores).toFixed(2)).toBe(l.total.n);
    expect(somaN(c.totaisMes).toFixed(2)).toBe(modelo.sintetica.total.n);
    expect(c.acumulado.at(-1)!.n).toBe(modelo.sintetica.total.n);
    expect(c.percentualAcumulado.at(-1)!.br).toBe("100,00%");
    expect(c.semDistribuicao).toEqual([]);
  });

  it("aponta etapas sem distribuição no cronograma em vez de inventar valores", () => {
    const d = { ...dados, cronograma: dados.cronograma.filter((l) => l.etapa !== "pintura") };
    const m = montarModeloRelatorio(d, { dataEmissao: "25/11/2026" });
    expect(m.cronograma.semDistribuicao).toEqual(["Pintura"]);
  });

  it("agrupa a memória de cálculo por ambiente, com a obra geral por último", () => {
    expect(modelo.memoria.map((g) => g.nome)).toEqual(["Sala", "Quarto 1", "Obra (geral)"]);
    expect(modelo.memoria[0]!.itens.map((i) => i.numero)).toEqual(["5.1", "14.1"]);
    expect(modelo.memoria[2]!.itens[0]!.memoria).toBe("10 × 10 = 100");
    expect(modelo.memoria[1]!.itens[0]!.memoria).toBe("—");
  });

  it("cabeçalho: datas-base, aviso de datas diferentes e responsável em branco quando ausente", () => {
    const c = modelo.cabecalho;
    expect(c.datasBase).toEqual(["SINAPI PI 10/2026 não desonerado", "SICRO PI 07/2026 não desonerado"]);
    expect(modelo.avisos.some((a) => a.includes("datas-base diferentes"))).toBe(true);
    expect(c.responsavel).toBeNull();
    expect(c.empresa.cnpj).toBe("—");
    expect(c.desoneracao).toBe("Não desonerado");
    expect(modelo.indicadores.cub.br).toBe("—");
    expect(modelo.indicadores.diferencaCub.br).toBe("—");
    expect(modelo.indicadores.prazoMeses).toBe(3);
  });

  it("compara o custo/m² com o CUB quando informado e mostra o responsável técnico", () => {
    const m = montarModeloRelatorio(
      dadosFixture({ cub: "100", responsavel: { nome: "Eng. Fictício", registro: "CREA 000000", art: "" } }),
      { dataEmissao: "25/11/2026" },
    );
    expect(m.indicadores.cub.br).toBe("100,00");
    expect(m.indicadores.custoM2.n).toBe(dados.resultado.custoM2!.toFixed(2));
    expect(m.indicadores.diferencaCub.n).not.toBeNull();
    expect(m.cabecalho.responsavel).toEqual({ nome: "Eng. Fictício", registro: "CREA 000000", art: "—" });
  });

  it("quadro de BDI com componentes, taxa e alertas de faixa", () => {
    const [servico, material] = modelo.bdi.quadros;
    expect(servico!.taxa.br).toBe(modelo.cabecalho.bdiServico.br);
    expect(servico!.componentes.find((c) => c.sigla === "AC")!.referencia).toBe("3,00% a 5,50%");
    expect(material!.alertas.some((a) => a.includes("AC") && a.includes("acima"))).toBe(true);
    const semFaixas = montarModeloRelatorio(dados, { dataEmissao: "x" });
    expect(semFaixas.bdi.quadros[0]!.alertas[0]).toContain("indisponíveis");
  });

  it("abre as composições SINAPI do fechamento e aponta as ausentes", () => {
    const porChave = new Map(modelo.composicoes.map((c) => [c.chave, c]));
    const loc = porChave.get("SINAPI 1001")!;
    expect(loc.linhas.map((l) => [l.codigo, l.descricao, l.total.br])).toEqual([
      ["I1", "SERVENTE (FICTÍCIO)", "5,00"], ["I2", "PONTALETE (FICTÍCIO)", "5,00"],
    ]);
    expect(loc.custo.br).toBe("10,00");
    expect(porChave.get("SINAPI 2002")!.linhas[0]!.grupo).toBe("COMPOSICAO");
    expect(porChave.get("SINAPI 4004")!.faltantes[0]).toContain("não está na base");
    expect(porChave.has("SICRO 3003")).toBe(false);
    expect(porChave.get("PRÓPRIA X1")!.linhas).toEqual([]);
  });

  it("encargos sociais por base selecionada (percentual do banco → fração)", () => {
    const m = montarModeloRelatorio(dados, {
      dataEmissao: "x", encargos: [{ base_id: "base-sinapi", horista_pct: "113.68", mensalista_pct: null }],
    });
    expect(m.bdi.encargos).toEqual([{ base: "SINAPI PI 10/2026 não desonerado", horista: { br: "113,68%", n: "1.1368" }, mensalista: { br: "—", n: null } }]);
  });

  it("o modelo é serializável (JSON ida e volta)", () => {
    expect(JSON.parse(JSON.stringify(modelo))).toEqual(modelo);
  });
});
