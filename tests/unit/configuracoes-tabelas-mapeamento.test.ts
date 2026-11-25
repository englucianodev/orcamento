import { describe, expect, it } from "vitest";
import {
  alertaUnidade, contarMapeadas, paraMapeamentos, resumirMapeamento, rotuloPadroes, type LinhaMapeamentoBanco,
} from "@/components/configuracoes/mapeamento-efetivo";
import {
  formatarTabela, tabelasEfetivas, TAMANHOS_RESERVATORIO, validarTabela,
} from "@/components/configuracoes/tabelas-esquemas";
import { TABELAS_PADRAO } from "@/lib/engine/tabelas";

describe("tabelas paramétricas", () => {
  it("aceita os valores padrão do motor em todas as tabelas", () => {
    for (const chave of ["pontosHidraulicos", "regraTug", "fatorPrazo", "curvaEtapas", "reservatoriosComerciais"] as const) {
      const r = validarTabela(chave, formatarTabela(TABELAS_PADRAO[chave]));
      expect(r.ok, chave).toBe(true);
    }
  });

  it("rejeita curva com início maior que o fim ou fora de 0..1", () => {
    const curva = { ...TABELAS_PADRAO.curvaEtapas, fundacao: [0.5, 0.2] };
    const r = validarTabela("curvaEtapas", JSON.stringify(curva));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.erro).toMatch(/fundacao/);
    expect(validarTabela("curvaEtapas", JSON.stringify({ ...TABELAS_PADRAO.curvaEtapas, pintura: [0, 1.2] })).ok).toBe(false);
  });

  it("exige todas as etapas/ambientes e rejeita chaves desconhecidas", () => {
    const faltando = Object.fromEntries(Object.entries(TABELAS_PADRAO.curvaEtapas).filter(([k]) => k !== "pintura"));
    expect(validarTabela("curvaEtapas", JSON.stringify(faltando)).ok).toBe(false);
    expect(validarTabela("regraTug", JSON.stringify({ ...TABELAS_PADRAO.regraTug, sotao: "um" })).ok).toBe(false);
    expect(validarTabela("regraTug", JSON.stringify({ ...TABELAS_PADRAO.regraTug, quarto: "dois" })).ok).toBe(false);
    expect(validarTabela("pontosHidraulicos", JSON.stringify({ ...TABELAS_PADRAO.pontosHidraulicos, quarto: ["banheira"] })).ok).toBe(false);
  });

  it("valida fator de prazo como decimal positivo em texto", () => {
    const r = validarTabela("fatorPrazo", '{"baixo": 0.9, "normal": "1", "alto": "1,15", "luxo": "1.3"}');
    expect(r).toEqual({ ok: true, valor: { baixo: "0.9", normal: "1", alto: "1.15", luxo: "1.3" } });
    expect(validarTabela("fatorPrazo", '{"baixo": "0", "normal": "1", "alto": "1", "luxo": "1"}').ok).toBe(false);
  });

  it("aceita só reservatórios do catálogo, sem repetição, e ordena", () => {
    expect(TAMANHOS_RESERVATORIO).toContain(1000);
    expect(validarTabela("reservatoriosComerciais", "[2000, 500]")).toEqual({ ok: true, valor: [500, 2000] });
    expect(validarTabela("reservatoriosComerciais", "[750]").ok).toBe(false);
    expect(validarTabela("reservatoriosComerciais", "[500, 500]").ok).toBe(false);
    expect(validarTabela("reservatoriosComerciais", "[]").ok).toBe(false);
    expect(validarTabela("reservatoriosComerciais", "[500,").ok).toBe(false);
  });

  it("monta o valor efetivo: padrão ← global ← empresa", () => {
    const efetivas = tabelasEfetivas([
      { empresa_id: "e1", chave: "fatorPrazo", config: { luxo: "1.5" } },
      { empresa_id: null, chave: "fatorPrazo", config: { luxo: "1.4", alto: "1.2" } },
      { empresa_id: null, chave: "reservatoriosComerciais", config: [500, 1000] },
      { empresa_id: null, chave: "desconhecida", config: {} },
    ]);
    expect(efetivas.fatorPrazo).toEqual({ baixo: "0.9", normal: "1", alto: "1.2", luxo: "1.5" });
    expect(efetivas.reservatoriosComerciais).toEqual([500, 1000]);
    expect(efetivas.curvaEtapas).toEqual(TABELAS_PADRAO.curvaEtapas);
  });
});

describe("mapeamento efetivo", () => {
  const linha = (o: Partial<LinhaMapeamentoBanco> & { id: string }): LinhaMapeamentoBanco => ({
    empresa_id: null, chave: "PISO", padrao: null, fonte: "SINAPI", codigo: "100", fator_conversao: 1, ...o,
  });

  it("sem linhas: não mapeado", () => {
    const r = resumirMapeamento("PISO", []);
    expect(r.situacao).toBe("nao_mapeado");
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0]?.linha).toBeNull();
  });

  it("linha global sem padrão vale para todos; a da empresa por padrão tem precedência", () => {
    const lista = paraMapeamentos([
      linha({ id: "g" }),
      linha({ id: "e-alto", empresa_id: "e1", padrao: "alto", codigo: "200", fator_conversao: "0.05" }),
    ]);
    const r = resumirMapeamento("PISO", lista);
    expect(r.situacao).toBe("mapeado");
    expect(r.grupos.map((g) => [g.padroes.join("+"), g.linha?.id])).toEqual([
      ["baixo+normal", "g"], ["alto", "e-alto"], ["luxo", "g"],
    ]);
    expect(rotuloPadroes(r.grupos[0]!.padroes)).toBe("Baixo, Normal");
  });

  it("empresa sem padrão sobrepõe a global; parcial quando falta padrão", () => {
    const lista = paraMapeamentos([
      linha({ id: "g" }),
      linha({ id: "e", empresa_id: "e1", fonte: "PROPRIA", codigo: "P1" }),
      linha({ id: "x", chave: "FORRO", padrao: "luxo" }),
      linha({ id: "ruim", chave: "FORRO", fonte: "OUTRA" }),
    ]);
    const piso = resumirMapeamento("PISO", lista);
    expect(piso.grupos).toEqual([{ padroes: ["baixo", "normal", "alto", "luxo"], linha: expect.objectContaining({ id: "e" }) }]);
    expect(rotuloPadroes(piso.grupos[0]!.padroes)).toBe("Todos os padrões");
    expect(resumirMapeamento("FORRO", lista).situacao).toBe("parcial");
    expect(contarMapeadas(["PISO", "FORRO", "TELHA"], lista)).toBe(1);
  });

  it("avisa unidade diferente só quando o fator é 1", () => {
    expect(alertaUnidade("m²", "M2", "1")).toBeNull();
    expect(alertaUnidade("m²", "m³", "1")).toMatch(/fator/);
    expect(alertaUnidade("m²", "m³", "0.05")).toBeNull();
    expect(alertaUnidade("m²", null, "1")).toBeNull();
  });
});
