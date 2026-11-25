import { describe, expect, it } from "vitest";
import { entradaSchema } from "@/lib/engine/entrada.schema";
import { interpretarAtalho, sugerirAmbiente } from "@/lib/engine/padroes";
import { gerarQuantitativos } from "@/lib/engine/quantitativos";
import { geometriaTelhado } from "@/lib/engine/quantitativos/cobertura";
import { casaCompleta, entrada, quartoAceite } from "./entrada-exemplo";

const chaves = (itens: ReturnType<typeof gerarQuantitativos>) => new Set(itens.map((i) => i.chaveServico));
const qtd = (itens: ReturnType<typeof gerarQuantitativos>, chave: string) =>
  itens.filter((i) => i.chaveServico === chave).reduce((s, i) => s + Number(i.quantidade), 0);

describe("entrada (Zod)", () => {
  it("rejeita medidas fora dos limites e ambiente sem medidas", () => {
    const q = quartoAceite();
    const r = entradaSchema.safeParse({ versao: 1, dadosGerais: { nome: "X", uf: "PI", padrao: "normal" }, terreno: { largura: 10, profundidade: 20 }, cobertura: { telha: "ceramica" }, ambientes: [{ ...q, peDireito: 1.5 }] });
    expect(r.success).toBe(false);
    const semMedida = entradaSchema.safeParse({ versao: 1, dadosGerais: { nome: "X", uf: "PI", padrao: "normal" }, terreno: { largura: 10, profundidade: 20 }, cobertura: { telha: "ceramica" }, ambientes: [{ ...q, largura: null, comprimento: null }] });
    expect(semMedida.success).toBe(false);
  });

  it("rejeita ambiente em pavimento inexistente e ids repetidos", () => {
    const q = quartoAceite();
    const base = { versao: 1, dadosGerais: { nome: "X", uf: "PI", padrao: "normal" }, terreno: { largura: 10, profundidade: 20 }, cobertura: { telha: "ceramica" } };
    expect(entradaSchema.safeParse({ ...base, ambientes: [{ ...q, pavimento: 2 }] }).success).toBe(false);
    expect(entradaSchema.safeParse({ ...base, ambientes: [q, q] }).success).toBe(false);
  });
});

describe("atalhos e sugestões", () => {
  it("interpreta texto livre de ambientes", () => {
    expect(interpretarAtalho("3 quartos, 1 suíte, 2 banheiros e lavabo")).toEqual([
      { tipo: "quarto", quantidade: 3 }, { tipo: "suite", quantidade: 1 },
      { tipo: "banheiro", quantidade: 2 }, { tipo: "lavabo", quantidade: 1 },
    ]);
    expect(interpretarAtalho("sala de jantar; garagem")).toEqual([{ tipo: "sala_jantar", quantidade: 1 }, { tipo: "garagem", quantidade: 1 }]);
  });

  it("sugere acabamentos pelo padrão", () => {
    const b = sugerirAmbiente("banheiro", "baixo", "b1");
    expect(b.revestimentoParede).toEqual({ tipo: "ceramica", altura: 1.5, ateOTeto: false });
    expect(b.forro).toBe("pvc");
    const v = sugerirAmbiente("varanda", "alto", "v1");
    expect(v.paredes.modo).toBe("nenhuma");
    expect(v.forro).toBe("sem_forro");
  });
});

describe("variantes construtivas", () => {
  it("radier, sapata e hélice contínua", () => {
    const radier = gerarQuantitativos(entrada([quartoAceite()], { construcao: { fundacao: "radier", projecaoLargura: 10, projecaoComprimento: 10 } }));
    expect(qtd(radier, "CONCRETO_RADIER").toFixed(2)).toBe("12.00");
    expect(chaves(radier).has("CONCRETO_BALDRAME")).toBe(false);
    const sapata = gerarQuantitativos(entrada([quartoAceite()], { construcao: { fundacao: "sapata" } }));
    expect(chaves(sapata).has("CONCRETO_SAPATA")).toBe(true);
    const tres = casaCompleta().ambientes.map((a, i) => ({ ...a, pavimento: (i % 3) + 1 }));
    const helice = gerarQuantitativos(entrada(tres));
    expect(chaves(helice).has("ESTACA_HELICE_CONTINUA")).toBe(true);
    expect(qtd(helice, "ESCADA_CONCRETO")).toBe(2);
    expect(qtd(helice, "QUADRO_DISTRIBUICAO")).toBe(3);
  });

  it("estrutura metálica, alvenaria estrutural e drywall", () => {
    const met = gerarQuantitativos(entrada([quartoAceite()], { construcao: { estrutura: "metalica", vedacao: "drywall" } }));
    expect(chaves(met).has("ESTRUTURA_METALICA")).toBe(true);
    expect(chaves(met).has("DRYWALL_PAREDE")).toBe(true);
    expect(chaves(met).has("VERGA_CONTRAVERGA")).toBe(false);
    const est = gerarQuantitativos(entrada([quartoAceite()], { construcao: { estrutura: "alvenaria_estrutural" } }));
    expect(chaves(est).has("ALV_ESTRUTURAL_BLOCO_CONCRETO_14CM")).toBe(true);
    expect(chaves(est).has("ENCUNHAMENTO")).toBe(false);
    const bloco = gerarQuantitativos(entrada([quartoAceite()], { construcao: { vedacao: "bloco_concreto", espessuraParede: 0.19 } }));
    expect(chaves(bloco).has("ALV_BLOCO_CONCRETO_19CM")).toBe(true);
  });

  it("telhado de 4 águas com platibanda, calhas e rufos", () => {
    const e = entrada([quartoAceite()], {
      construcao: { projecaoLargura: 10, projecaoComprimento: 12 },
      cobertura: { telha: "fibrocimento", aguas: 4, beiral: 0, inclinacao: 30, estrutura: "metalica", platibanda: { existe: true, altura: 1 } },
    });
    const itens = gerarQuantitativos(e);
    const t = geometriaTelhado(10, 12, 0, 30);
    expect(t.projecao.toFixed(2)).toBe("120.00");
    expect(qtd(itens, "CALHA").toFixed(2)).toBe("44.00");
    expect(qtd(itens, "RUFO").toFixed(2)).toBe("44.00");
    // cumeeira 2 + 4 espigões de √(5² × 2 + 1,5²) = 7,2284
    expect(qtd(itens, "CUMEEIRA").toFixed(2)).toBe("30.91");
    expect(chaves(itens).has("ESTRUTURA_TELHADO_METALICA")).toBe(true);
  });

  it("piscinas de vinil, alvenaria e fibra", () => {
    const base = casaCompleta();
    const comTipo = (tipo: "vinil" | "fibra" | "alvenaria") =>
      gerarQuantitativos(entrada(base.ambientes, { lazer: { piscina: { existe: true, tipo, aquecimento: tipo === "vinil" ? "solar" : tipo === "fibra" ? "gas" : "bomba_calor" } } }, "normal"));
    const vinil = comTipo("vinil");
    expect(chaves(vinil).has("VINIL_PISCINA")).toBe(true);
    expect(chaves(vinil).has("AQUECIMENTO_PISCINA_SOLAR")).toBe(true);
    const fibra = comTipo("fibra");
    expect(chaves(fibra).has("PISCINA_FIBRA")).toBe(true);
    expect(chaves(fibra).has("CONCRETO_PISCINA")).toBe(false);
    expect(chaves(comTipo("alvenaria")).has("ALVENARIA_PISCINA")).toBe(true);
  });

  it("área manual, pé-direito duplo e ambiente descoberto", () => {
    const a = { ...quartoAceite(), largura: null, comprimento: null, areaManual: 20, peDireitoDuplo: true };
    const desc = { ...quartoAceite(), id: "d1", nome: "Pátio", coberto: false, piso: "cimentado" as const, vaos: [] };
    const itens = gerarQuantitativos(entrada([a, desc], { instalacoes: { aguaQuente: "gas", reservatorioLitros: 1200, cisternaLitros: 5000 } }));
    expect(itens.find((i) => i.chaveServico === "FORRO_GESSO_PLACA" && i.ambienteId === "q1")?.memoria).toContain("área informada");
    expect(itens.some((i) => i.ambienteId === "d1" && i.etapa === "forro")).toBe(false);
    expect(qtd(itens, "RESERVATORIO_1500L")).toBe(1);
    expect(qtd(itens, "CISTERNA").toFixed(2)).toBe("5.00");
    expect(chaves(itens).has("AQUECEDOR_GAS")).toBe(true);
  });

  it("pinta teto sem forro apenas quando há laje", () => {
    const sem = { ...quartoAceite(), forro: "sem_forro" as const };
    const comLaje = gerarQuantitativos(entrada([sem]));
    expect(qtd(comLaje, "REBOCO_TETO").toFixed(2)).toBe("12.00");
    expect(qtd(comLaje, "LAJE_TRELICADA")).toBeGreaterThan(0);
    const semLaje = gerarQuantitativos(entrada([sem], { construcao: { laje: "sem_laje" } }));
    expect(qtd(semLaje, "REBOCO_TETO")).toBe(0);
    expect(qtd(semLaje, "PINTURA_TETO")).toBe(0);
  });
});
