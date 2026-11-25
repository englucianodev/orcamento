import { describe, expect, it } from "vitest";
import { CATALOGO_SERVICOS, ETAPAS } from "@/lib/engine/catalogo";
import { criarIndices } from "@/lib/engine/indices";
import { gerarQuantitativos } from "@/lib/engine/quantitativos";
import { geometriaTelhado } from "@/lib/engine/quantitativos/cobertura";
import { geometriaPiscina } from "@/lib/engine/quantitativos/piscina";
import { escolherReservatorio } from "@/lib/engine/quantitativos/hidrossanitaria";
import { casaCompleta, entrada, quartoAceite } from "./entrada-exemplo";

const todosOsVaos = { indices: criarIndices({ desconto_vaos_area_minima: "0" }) };
const qtd = (itens: ReturnType<typeof gerarQuantitativos>, chave: string, ambienteId?: string) =>
  itens.filter((i) => i.chaveServico === chave && (ambienteId === undefined || i.ambienteId === ambienteId))
    .reduce((s, i) => s + Number(i.quantidade), 0);

describe("caso de aceite 1 — quantitativos do quarto", () => {
  const itens = gerarQuantitativos(entrada([quartoAceite()]), todosOsVaos);

  it("rodapé, forro, tabica, TUG e pontos de luz", () => {
    expect(qtd(itens, "RODAPE_CERAMICO", "q1").toFixed(2)).toBe("13.20");
    expect(qtd(itens, "FORRO_GESSO_PLACA", "q1").toFixed(2)).toBe("12.00");
    expect(qtd(itens, "TABICA_GESSO", "q1").toFixed(2)).toBe("14.00");
    expect(qtd(itens, "PONTO_TOMADA_TUG", "q1")).toBe(3);
    expect(qtd(itens, "PONTO_LUZ", "q1")).toBe(1);
    expect(qtd(itens, "CHAPISCO_INTERNO", "q1").toFixed(2)).toBe("36.32");
  });

  it("toda quantidade tem memória de cálculo", () => {
    for (const i of itens) expect(i.memoria.length).toBeGreaterThan(5);
    const rodape = itens.find((i) => i.chaveServico === "RODAPE_CERAMICO");
    expect(rodape?.memoria).toBe("Quarto 1: 14,00 − 0,80 (portas) = 13,20 m");
  });
});

describe("caso de aceite 2 — telhado", () => {
  it("projeção 10 × 12, beiral 0,60, inclinação 30%", () => {
    const t = geometriaTelhado(10, 12, 0.6, 30);
    expect(t.projecao.toFixed(2)).toBe("147.84");
    expect(t.areaInclinada.toFixed(2)).toBe("154.35");
  });

  it("gera telha e estrutura pela área inclinada", () => {
    const e = entrada([quartoAceite()], { construcao: { projecaoLargura: 10, projecaoComprimento: 12 }, cobertura: { telha: "ceramica", inclinacao: 30, beiral: 0.6, aguas: 2 } });
    const itens = gerarQuantitativos(e);
    expect(qtd(itens, "TELHA_CERAMICA").toFixed(2)).toBe("154.35");
    expect(qtd(itens, "ESTRUTURA_TELHADO_MADEIRA").toFixed(2)).toBe("154.35");
    expect(qtd(itens, "CUMEEIRA").toFixed(2)).toBe("13.20");
  });

  it("laje impermeabilizada: área + perímetro × 0,30", () => {
    const e = entrada([quartoAceite()], { construcao: { projecaoLargura: 10, projecaoComprimento: 12 }, cobertura: { telha: "laje_impermeabilizada", beiral: 0 } });
    const itens = gerarQuantitativos(e);
    expect(qtd(itens, "IMPERMEABILIZACAO_LAJE_COBERTURA").toFixed(2)).toBe("133.20");
    expect(qtd(itens, "TELHA_CERAMICA")).toBe(0);
  });
});

describe("caso de aceite 3 — piscina 8 × 4, profundidade 1,20 a 1,60", () => {
  it("volume, escavação e revestimento", () => {
    const g = geometriaPiscina({ comprimento: 8, largura: 4, profundidadeMin: 1.2, profundidadeMax: 1.6 }, criarIndices());
    expect(g.profundidadeMedia.toFixed(2)).toBe("1.40");
    expect(g.volume.toFixed(2)).toBe("44.80");
    expect(g.escavacao.toFixed(2)).toBe("76.50");
    expect(g.revestimento.toFixed(2)).toBe("65.60");
  });

  it("emite os itens da piscina", () => {
    const itens = gerarQuantitativos(casaCompleta());
    expect(qtd(itens, "ESCAVACAO_PISCINA").toFixed(2)).toBe("76.50");
    expect(qtd(itens, "REVESTIMENTO_PISCINA").toFixed(2)).toBe("65.60");
    expect(qtd(itens, "BOTA_FORA_PISCINA").toFixed(2)).toBe("95.63");
    expect(qtd(itens, "BORDA_PISCINA").toFixed(2)).toBe("24.00");
    expect(itens.find((i) => i.chaveServico === "FILTRO_BOMBA_PISCINA")?.memoria).toContain("44,80 m³");
  });
});

describe("regras das etapas", () => {
  it("TUG de cozinha usa perímetro / 3,5 e banheiro tem 1", () => {
    const itens = gerarQuantitativos(casaCompleta("baixo"));
    expect(qtd(itens, "PONTO_TOMADA_TUG", "cozinha-1")).toBe(4);
    expect(qtd(itens, "PONTO_TOMADA_TUG", "banheiro-1")).toBe(1);
  });

  it("multiplicador do padrão aumenta os pontos de luz", () => {
    const sala = casaCompleta("luxo").ambientes.find((a) => a.tipo === "sala_estar")!;
    const itens = gerarQuantitativos(entrada([sala], {}, "luxo"));
    // 20 m² / 12 = 1,67 → 2 pontos × 2,0 = 4
    expect(qtd(itens, "PONTO_LUZ", sala.id)).toBe(4);
  });

  it("reservatório: moradores × 200 L × 2 dias no tamanho comercial", () => {
    expect(escolherReservatorio(3200, [500, 1000, 1500, 2000, 3000, 5000, 10000])).toEqual({ litros: 5000, quantidade: 1 });
    expect(escolherReservatorio(23000, [500, 10000])).toEqual({ litros: 10000, quantidade: 3 });
    const itens = gerarQuantitativos(casaCompleta());
    expect(qtd(itens, "RESERVATORIO_5000L")).toBe(1);
    expect(qtd(itens, "FOSSA_SEPTICA")).toBe(1);
  });

  it("terraplenagem pequena usa SINAPI e grande usa SICRO com DMT", () => {
    const pequena = gerarQuantitativos(entrada([quartoAceite()], { terreno: { largura: 12, profundidade: 30, desnivel: 2 }, construcao: { projecaoLargura: 10, projecaoComprimento: 10 } }));
    expect(qtd(pequena, "CORTE_TERRENO_SINAPI").toFixed(2)).toBe("100.00");
    expect(qtd(pequena, "CARGA_TRANSPORTE_BOTA_FORA_SINAPI").toFixed(2)).toBe("125.00");
    const grande = gerarQuantitativos(entrada([quartoAceite()], { terreno: { largura: 40, profundidade: 40, desnivel: 6, dmtBotaForaKm: 8 }, construcao: { projecaoLargura: 20, projecaoComprimento: 20 } }));
    expect(qtd(grande, "ESCAVACAO_CARGA_SICRO").toFixed(2)).toBe("1200.00");
    expect(qtd(grande, "TRANSPORTE_BOTA_FORA_SICRO").toFixed(2)).toBe("12000.00");
    expect(qtd(grande, "CORTE_TERRENO_SINAPI")).toBe(0);
  });

  it("sem desnível não há terraplenagem", () => {
    expect(gerarQuantitativos(entrada([quartoAceite()])).filter((i) => i.etapa === "terraplenagem")).toHaveLength(0);
  });

  it("muro com pilaretes e reboco nas duas faces", () => {
    const itens = gerarQuantitativos(casaCompleta());
    // frente 15 − portão 3 + fundos 15 + laterais 2 × 30 = 87 m × 2,20
    expect(qtd(itens, "MURO_ALVENARIA").toFixed(2)).toBe("191.40");
    expect(qtd(itens, "MURO_CHAPISCO_REBOCO").toFixed(2)).toBe("382.80");
    expect(qtd(itens, "MOTOR_PORTAO")).toBe(1);
  });
});

describe("integridade", () => {
  const itens = gerarQuantitativos(casaCompleta());

  it("só emite chaves do catálogo, com a unidade do catálogo", () => {
    const cat = new Map(CATALOGO_SERVICOS.map((s) => [s.chave, s]));
    for (const i of itens) {
      expect(cat.get(i.chaveServico)?.unidade, i.chaveServico).toBe(i.unidade);
      expect(cat.get(i.chaveServico)?.etapa, i.chaveServico).toBe(i.etapa);
    }
  });

  it("quantidades positivas com até 4 casas", () => {
    for (const i of itens) {
      expect(Number(i.quantidade), i.chaveServico).toBeGreaterThan(0);
      expect(i.quantidade).toMatch(/^\d+(\.\d{1,4})?$/);
    }
  });

  it("a casa completa passa por quase todas as etapas", () => {
    const etapas = new Set(itens.map((i) => i.etapa));
    const faltando = ETAPAS.map((e) => e.id).filter((e) => !etapas.has(e));
    expect(faltando).toEqual([]);
  });

  it("catálogo sem chaves repetidas", () => {
    expect(new Set(CATALOGO_SERVICOS.map((s) => s.chave)).size).toBe(CATALOGO_SERVICOS.length);
  });
});
