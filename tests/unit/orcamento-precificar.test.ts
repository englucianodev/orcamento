import { describe, expect, it } from "vitest";
import { D } from "@/lib/engine/decimal";
import { faixasDoBanco, montarConfigMotor, taxaBdi } from "@/lib/orcamento/config";
import { fechamentoSchema, fontePropria, fonteSicro, fonteSinapi, type Fechamento } from "@/lib/orcamento/fechamento";
import { chaveLinha, codigosNecessarios, precificarItens, resolverMapeamento, type Mapeamento } from "@/lib/orcamento/precificar";
import type { ItemQuantitativo } from "@/lib/engine/quantitativos";

const nulos = { utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null };
const sinapi: Fechamento = fechamentoSchema.parse({
  composicoes: [
    { codigo: "100", descricao: "Alvenaria bloco cerâmico", unidade: "M2", grupo: null, preco_publicado: "57.04", producao_equipe: null, fic: null },
    { codigo: "200", descricao: "Argamassa", unidade: "M3", grupo: null, preco_publicado: "500", producao_equipe: null, fic: null },
    { codigo: "300", descricao: "Serviço com insumo sem preço", unidade: "UN", grupo: null, preco_publicado: null, producao_equipe: null, fic: null },
  ],
  itens: [
    { composicao_codigo: "100", tipo_item: "COMPOSICAO", item_codigo: "200", coeficiente: "0.012", ...nulos },
    { composicao_codigo: "100", tipo_item: "INSUMO", item_codigo: "1", coeficiente: "1.333", ...nulos },
    { composicao_codigo: "200", tipo_item: "INSUMO", item_codigo: "2", coeficiente: "1", ...nulos },
    { composicao_codigo: "300", tipo_item: "INSUMO", item_codigo: "3", coeficiente: "1", ...nulos },
  ],
  insumos: [
    { codigo: "1", descricao: "Pedreiro", unidade: "H", tipo: "MAO_OBRA", preco: "38.3333", origem_preco: "C", chp: null, chi: null },
    { codigo: "2", descricao: "Argamassa pronta", unidade: "M3", tipo: "MATERIAL", preco: "500", origem_preco: "C", chp: null, chi: null },
    { codigo: "3", descricao: "Material raro", unidade: "UN", tipo: "MATERIAL", preco: null, origem_preco: null, chp: null, chi: null },
  ],
});

const item = (chaveServico: string, quantidade: string, unidade = "m²", ambienteId: string | null = null): ItemQuantitativo =>
  ({ etapa: "alvenaria", chaveServico, ambienteId, quantidade, unidade, memoria: "memória" });

const mapa = (chave: string, codigo: string, extra: Partial<Mapeamento> = {}): Mapeamento =>
  ({ empresaId: null, chave, padrao: null, fonte: "SINAPI", codigo, fatorConversao: "1", ...extra });

describe("fontes de custo", () => {
  it("SINAPI: calcula com truncamento por linha e informa faltantes", () => {
    const f = fonteSinapi(sinapi, "SINAPI PI 10/2026");
    // 0,012 × 500 = 6,00 ; 1,333 × 38,3333 = 51,0982… → 51,09 (truncado) ; total 57,09
    expect(f.custo("100").custo?.toFixed(2)).toBe("57.09");
    expect(f.custo("300").custo).toBeNull();
    expect(f.custo("300").faltantes.join()).toContain("3");
    expect(f.custo("999").faltantes.join()).toContain("não está na base");
    expect(f.descricao("100")).toEqual({ descricao: "Alvenaria bloco cerâmico", unidade: "M2" });
  });

  it("SICRO: usa CHP/CHI do equipamento e a produção da equipe", () => {
    const sicro = fechamentoSchema.parse({
      composicoes: [{ codigo: "S1", descricao: "Escavação", unidade: "m³", grupo: null, preco_publicado: null, producao_equipe: "10", fic: "0" }],
      itens: [{ composicao_codigo: "S1", tipo_item: "INSUMO", item_codigo: "E1", coeficiente: "1", utilizacao_operativa: "1", utilizacao_improdutiva: "0", grupo_sicro: "A", extra: null }],
      insumos: [{ codigo: "E1", descricao: "Escavadeira", unidade: "h", tipo: "EQUIPAMENTO", preco: "200", origem_preco: null, chp: "200", chi: "80" }],
    });
    const f = fonteSicro(sicro, "SICRO PI", { ln: 0, rp: 0, p: 0 });
    expect(f.custo("S1").custo?.toFixed(2)).toBe("20.00");
  });

  it("própria: custo informado", () => {
    const f = fontePropria([{ codigo: "P1", descricao: "Serviço próprio", unidade: "un", custo: "12.5" }, { codigo: "P2", descricao: "Sem custo", unidade: "un", custo: null }]);
    expect(f.custo("P1").custo?.toFixed(2)).toBe("12.50");
    expect(f.custo("P2").custo).toBeNull();
    expect(f.existe("P3")).toBe(false);
  });
});

describe("mapeamento", () => {
  it("prefere empresa+padrão, depois empresa, global+padrão e global", () => {
    const lista: Mapeamento[] = [
      mapa("ALV", "g"), mapa("ALV", "gp", { padrao: "alto" }), mapa("ALV", "e", { empresaId: "x" }),
      mapa("ALV", "ep", { empresaId: "x", padrao: "alto" }), mapa("ALV", "outro", { empresaId: "x", padrao: "baixo" }),
    ];
    expect(resolverMapeamento("ALV", "alto", lista)?.codigo).toBe("ep");
    expect(resolverMapeamento("ALV", "normal", lista)?.codigo).toBe("e");
    expect(resolverMapeamento("ALV", "normal", lista.slice(0, 2))?.codigo).toBe("g");
    expect(resolverMapeamento("NADA", "normal", lista)).toBeNull();
  });

  it("chaves SICRO preferem a fonte SICRO", () => {
    const lista = [mapa("ESCAVACAO_SICRO", "a"), mapa("ESCAVACAO_SICRO", "b", { fonte: "SICRO" })];
    expect(resolverMapeamento("ESCAVACAO_SICRO", "normal", lista)?.codigo).toBe("b");
  });
});

describe("precificação", () => {
  const fontes = { SINAPI: fonteSinapi(sinapi, "SINAPI PI 10/2026") };

  it("aplica fator de conversão, custo e mantém edição manual", () => {
    const itens = [item("ALV_BLOCO_CERAMICO_14CM", "10", "m²", "q1"), item("ENCUNHAMENTO", "3", "m")];
    const linhas = precificarItens({
      itens, padrao: "normal", fontes,
      mapeamentos: [mapa("ALV_BLOCO_CERAMICO_14CM", "100", { fatorConversao: "1.5" })],
      edicoesManuais: new Map([[chaveLinha("ALV_BLOCO_CERAMICO_14CM", "q1"), "20"]]),
    });
    const [alv, enc] = linhas;
    expect(alv).toMatchObject({ fonte: "SINAPI", codigo: "100", quantidadeCalculada: "15", quantidade: "20", custoUnitario: "57.0900", editadoManual: true, alerta: null, unidade: "M2" });
    expect(alv?.memoria).toContain("fator 1,5000");
    expect(enc).toMatchObject({ fonte: null, custoUnitario: null, editadoManual: false });
    expect(enc?.alerta).toContain("Sem composição mapeada");
  });

  it("alerta para base ausente, código inexistente e insumo sem preço", () => {
    const itens = [item("ALV_BLOCO_CERAMICO_14CM", "1"), item("ENCUNHAMENTO", "1", "m"), item("CHAPISCO_INTERNO", "1")];
    const linhas = precificarItens({
      itens, padrao: "normal", fontes,
      mapeamentos: [mapa("ALV_BLOCO_CERAMICO_14CM", "100", { fonte: "SICRO" }), mapa("ENCUNHAMENTO", "999"), mapa("CHAPISCO_INTERNO", "300")],
    });
    expect(linhas.map((l) => l.alerta?.slice(0, 20))).toEqual(["Nenhuma base SICRO s", "Composição SINAPI 99", "Sem custo em SINAPI "]);
  });

  it("itens percentuais não exigem composição", () => {
    const [l] = precificarItens({ itens: [item("PROJETOS_TAXAS", "5", "%")], padrao: "normal", fontes, mapeamentos: [] });
    expect(l).toMatchObject({ percentual: true, alerta: null, quantidade: "5" });
  });

  it("lista os códigos por base para o fechamento", () => {
    const itens = [item("ALV_BLOCO_CERAMICO_14CM", "1"), item("ENCUNHAMENTO", "1"), item("CHAPISCO_INTERNO", "1")];
    const r = codigosNecessarios(itens, "normal", [mapa("ALV_BLOCO_CERAMICO_14CM", "100"), mapa("ENCUNHAMENTO", "100"), mapa("CHAPISCO_INTERNO", "S", { fonte: "SICRO" })]);
    expect(r).toEqual({ SINAPI: ["100"], SICRO: ["S"], PROPRIA: [] });
  });
});

describe("configuração do banco", () => {
  it("empresa sobrescreve a semente global", () => {
    const c = montarConfigMotor({
      indices: [{ empresa_id: "e", chave: "k_paredes", valor: "0.2" }, { empresa_id: null, chave: "k_paredes", valor: "0.1" }],
      padroes: [{ empresa_id: "e", padrao: "normal", config: { sanca: true } }, { empresa_id: null, padrao: "xx", config: {} }],
      tabelas: [{ empresa_id: null, chave: "fatorPrazo", config: { normal: "2" } }, { empresa_id: null, chave: "desconhecida", config: {} }],
    });
    expect(c.indices.k_paredes.toString()).toBe("0.2");
    expect(c.padroes.normal.sanca).toBe(true);
    expect(c.padroes.normal.pisoSeco).toBe("porcelanato_60x60");
    expect(c.tabelas.fatorPrazo.normal).toBe("2");
    expect(c.tabelas.fatorPrazo.baixo).toBe("0.9");
  });

  it("BDI e faixas", () => {
    const b = { id: "1", nome: "x", tipo: "servico" as const, tipo_obra: "edificacoes", ac: "0.04", s: "0.004", r: "0.0127", g: "0.004", df: "0.0123", l: "0.074", i: "0.0665" };
    expect(taxaBdi(b).times(100).toFixed(2)).toBe("23.54");
    expect(taxaBdi(null).isZero()).toBe(true);
    const f = faixasDoBanco([{ tipo_obra: "edificacoes", componente: "ac", minimo: "3", medio: "4", maximo: "5.5" }, { tipo_obra: "outra", componente: "ac", minimo: 1, medio: 1, maximo: 1 }], "edificacoes");
    expect(f).toHaveLength(1);
    expect(new D(f[0]!.maximo).toString()).toBe("0.055");
  });
});
