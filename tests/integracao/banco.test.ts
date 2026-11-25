import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { CATALOGO_SERVICOS } from "@/lib/engine/catalogo";
import { INDICES_PADRAO } from "@/lib/engine/indices";
import { aplicarSeed, como, criarBanco, criarUsuario } from "./banco";

let db: PGlite;
let base: string;

const contar = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(sql, params)).rows[0]!.n);

const insumos = [
  { codigo: "00001", descricao: "Cimento Portland CP II", unidade: "KG", tipo: "MATERIAL", classificacao: null, preco: "0.85", origem_preco: "C" },
  { codigo: "00002", descricao: "Pedreiro com encargos", unidade: "H", tipo: "MAO_OBRA", classificacao: null, preco: "25.1234", origem_preco: "C" },
  { codigo: "E0001", descricao: "Caminhão basculante", unidade: "H", tipo: "EQUIPAMENTO", classificacao: null, preco: "180", origem_preco: "C" },
];
const composicoes = [
  { codigo: "C1", descricao: "Alvenaria de vedação com bloco cerâmico furado 14 cm", unidade: "M2", grupo: "ALVENARIA", preco_publicado: "80.12", producao_equipe: null, fic: null, fit: null },
  { codigo: "AUX", descricao: "Argamassa de assentamento traço 1:2:8", unidade: "M3", grupo: "ARGAMASSA", preco_publicado: "500", producao_equipe: null, fic: null, fit: null },
  { codigo: "T1", descricao: "Transporte com caminhão basculante em rodovia pavimentada", unidade: "TKM", grupo: "TRANSPORTE", preco_publicado: "1.2", producao_equipe: "100", fic: "0.01", fit: null },
  { codigo: "SOLTA", descricao: "Pintura látex acrílica", unidade: "M2", grupo: "PINTURA", preco_publicado: "20", producao_equipe: null, fic: null, fit: null },
];
const itens = [
  { composicao_codigo: "C1", tipo_item: "COMPOSICAO", item_codigo: "AUX", coeficiente: "0.012", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
  { composicao_codigo: "C1", tipo_item: "INSUMO", item_codigo: "00002", coeficiente: "0.5", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
  { composicao_codigo: "C1", tipo_item: "INSUMO", item_codigo: "00001", coeficiente: "2", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: "F", extra: { ln: null, rp: null, p: "T1" } },
  { composicao_codigo: "C1", tipo_item: "INSUMO", item_codigo: "99999", coeficiente: "1", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
  { composicao_codigo: "AUX", tipo_item: "INSUMO", item_codigo: "00001", coeficiente: "300", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
  { composicao_codigo: "T1", tipo_item: "INSUMO", item_codigo: "E0001", coeficiente: "1", utilizacao_operativa: "1", utilizacao_improdutiva: "0", grupo_sicro: "A", extra: null },
];

beforeAll(async () => {
  db = await criarBanco();
  const r = await db.query<{ id: string }>(
    "insert into public.bases_referencia (fonte, uf, mes_ano, desonerado) values ('SINAPI', 'PI', '2026-10-01', false) returning id",
  );
  base = r.rows[0]!.id;
  await como(db, "service_role", { role: "service_role" }, async () => {
    await db.query("select public.importar_insumos($1, $2)", [base, JSON.stringify(insumos)]);
    await db.query("select public.importar_equipamentos($1, $2)", [base, JSON.stringify([{ codigo: "E0001", chp: "180", chi: "60" }])]);
    await db.query("select public.importar_composicoes($1, $2)", [base, JSON.stringify(composicoes)]);
    await db.query("select public.importar_itens($1, 1, $2)", [base, JSON.stringify(itens)]);
    await db.query("select public.importar_encargos($1, 0.8, 0.5)", [base]);
  });
}, 120_000);

describe("seed", () => {
  it("carrega catálogo, índices, padrões, tabelas, faixas e BDI globais sem códigos de composição", async () => {
    expect(await contar("select count(*)::int n from public.servicos_catalogo")).toBe(CATALOGO_SERVICOS.length);
    expect(await contar("select count(*)::int n from public.indices_parametricos where empresa_id is null")).toBe(INDICES_PADRAO.length);
    expect(await contar("select count(*)::int n from public.padroes_acabamento")).toBe(4);
    expect(await contar("select count(*)::int n from public.tabelas_parametricas")).toBe(5);
    expect(await contar("select count(*)::int n from public.bdi_faixas")).toBe(12);
    expect(await contar("select count(*)::int n from public.bdi_config where empresa_id is null")).toBe(2);
    expect(await contar("select count(*)::int n from public.servicos_mapeamento")).toBe(0);
  });

  it("é idempotente", async () => {
    await aplicarSeed(db);
    expect(await contar("select count(*)::int n from public.indices_parametricos")).toBe(INDICES_PADRAO.length);
    expect(await contar("select count(*)::int n from public.bdi_config")).toBe(2);
  });
});

describe("importação", () => {
  it("resolve vínculos pelo código e mantém item sem vínculo quando o código não existe", async () => {
    const r = await db.query<{ item_codigo: string; insumo_id: string | null; composicao_aux_id: string | null }>(
      "select item_codigo, insumo_id, composicao_aux_id from public.composicao_itens ci join public.composicoes c on c.id = ci.composicao_id where c.codigo = 'C1' order by ci.id",
    );
    expect(r.rows.map((x) => [x.item_codigo, x.insumo_id !== null, x.composicao_aux_id !== null])).toEqual([
      ["AUX", false, true], ["00002", true, false], ["00001", true, false], ["99999", false, false],
    ]);
  });

  it("retomar o mesmo lote não duplica itens", async () => {
    const antes = await contar("select count(*)::int n from public.composicao_itens");
    await como(db, "service_role", { role: "service_role" }, () =>
      db.query("select public.importar_itens($1, 1, $2)", [base, JSON.stringify(itens)]));
    expect(await contar("select count(*)::int n from public.composicao_itens")).toBe(antes);
  });

  it("só a service role executa as funções de importação", async () => {
    const u = await criarUsuario(db, "intruso@exemplo.test");
    await expect(como(db, "authenticated", u, () =>
      db.query("select public.importar_insumos($1, '[]')", [base]))).rejects.toThrow(/permission denied/);
    await expect(como(db, "anon", null, () =>
      db.query("select public.importar_itens($1, 9, '[]')", [base]))).rejects.toThrow(/permission denied/);
  });

  it("autenticado lê a base mas não escreve nela", async () => {
    const u = await criarUsuario(db, "leitor@exemplo.test");
    const n = await como(db, "authenticated", u, () => contar("select count(*)::int n from public.insumos"));
    expect(n).toBe(3);
    await expect(como(db, "authenticated", u, () =>
      db.query("update public.insumos set preco = 0 where codigo = '00001'"))).resolves.toMatchObject({ affectedRows: 0 });
  });
});

describe("fechamento e busca", () => {
  it("fecha auxiliares e transportes recursivamente, com custos de equipamento", async () => {
    const u = await criarUsuario(db, "orc@exemplo.test");
    const r = await como(db, "authenticated", u, () =>
      db.query<{ f: { composicoes: Array<{ codigo: string }>; itens: unknown[]; insumos: Array<{ codigo: string; preco: string; chp: string | null }> } }>(
        "select public.fechamento_composicoes($1, array['C1']) f", [base]));
    const f = r.rows[0]!.f;
    expect(f.composicoes.map((c) => c.codigo).sort()).toEqual(["AUX", "C1", "T1"]);
    expect(f.itens).toHaveLength(6);
    expect(f.insumos.find((i) => i.codigo === "00002")?.preco).toBe("25.1234");
    expect(f.insumos.find((i) => i.codigo === "E0001")?.chp).toBe("180.0000");
  });

  it("anon não acessa o fechamento", async () => {
    await expect(como(db, "anon", null, () =>
      db.query("select public.fechamento_composicoes($1, array['C1'])", [base]))).rejects.toThrow(/permission denied/);
  });

  it("busca ignora acentos e prioriza o código exato", async () => {
    const u = await criarUsuario(db, "busca@exemplo.test");
    const porTexto = await como(db, "authenticated", u, () =>
      db.query<{ codigo: string }>("select codigo from public.buscar_composicoes($1, 'alvenaria vedacao ceramico')", [base]));
    expect(porTexto.rows[0]?.codigo).toBe("C1");
    const porCodigo = await como(db, "authenticated", u, () =>
      db.query<{ codigo: string }>("select codigo from public.buscar_composicoes($1, 'T1')", [base]));
    expect(porCodigo.rows[0]?.codigo).toBe("T1");
  });
});

describe("multiempresa (RLS) e aprovação", () => {
  it("isola orçamentos entre empresas e libera após aceitar convite", async () => {
    const a = await criarUsuario(db, "a@exemplo.test");
    const b = await criarUsuario(db, "b@exemplo.test");
    const empA = await como(db, "authenticated", a, async () =>
      (await db.query<{ id: string }>("select public.criar_empresa('Construtora A') id")).rows[0]!.id);
    const orc = await como(db, "authenticated", a, async () =>
      (await db.query<{ id: string }>("insert into public.orcamentos (empresa_id, nome, entrada) values ($1, 'Casa', '{}') returning id", [empA])).rows[0]!.id);

    expect(await como(db, "authenticated", b, () => contar("select count(*)::int n from public.orcamentos"))).toBe(0);
    await expect(como(db, "authenticated", b, () =>
      db.query("insert into public.orcamentos (empresa_id, nome, entrada) values ($1, 'Invasão', '{}')", [empA]))).rejects.toThrow(/row-level security/);

    const token = await como(db, "authenticated", a, async () =>
      (await db.query<{ token: string }>("insert into public.convites (empresa_id, email, papel) values ($1, 'b@exemplo.test', 'leitor') returning token", [empA])).rows[0]!.token);
    const outro = await criarUsuario(db, "c@exemplo.test");
    await expect(como(db, "authenticated", outro, () => db.query("select public.aceitar_convite($1)", [token]))).rejects.toThrow(/outro e-mail/);
    await como(db, "authenticated", b, () => db.query("select public.aceitar_convite($1)", [token]));
    expect(await como(db, "authenticated", b, () => contar("select count(*)::int n from public.orcamentos"))).toBe(1);
    // leitor não edita
    const upd = await como(db, "authenticated", b, () => db.query("update public.orcamentos set nome = 'X' where id = $1", [orc]));
    expect(upd.affectedRows).toBe(0);
  });

  it("orçamento aprovado bloqueia itens e valores", async () => {
    const a = await criarUsuario(db, "aprov@exemplo.test");
    await como(db, "authenticated", a, async () => {
      const emp = (await db.query<{ id: string }>("select public.criar_empresa('Construtora B') id")).rows[0]!.id;
      const orc = (await db.query<{ id: string }>("insert into public.orcamentos (empresa_id, nome, entrada) values ($1, 'Casa', '{}') returning id", [emp])).rows[0]!.id;
      await db.query("insert into public.orcamento_itens (orcamento_id, descricao, quantidade, custo_unitario) values ($1, 'Item', 1, 100)", [orc]);
      await db.query("update public.orcamentos set total = 100 where id = $1", [orc]);
      await db.query("select public.aprovar_orcamento($1)", [orc]);
      await expect(db.query("insert into public.orcamento_itens (orcamento_id, descricao) values ($1, 'Novo')", [orc])).rejects.toThrow(/aprovado/);
      await expect(db.query("update public.orcamentos set total = 1 where id = $1", [orc])).rejects.toThrow(/aprovado/);
      await db.query("select public.reabrir_orcamento($1)", [orc]);
      await db.query("insert into public.orcamento_itens (orcamento_id, descricao) values ($1, 'Novo')", [orc]);
    });
  });
});

describe("operações do orçamento (migration 0004)", () => {
  it("lista membros com e-mail só para quem é da empresa", async () => {
    const a = await criarUsuario(db, "dono@exemplo.test");
    const fora = await criarUsuario(db, "fora@exemplo.test");
    const emp = await como(db, "authenticated", a, async () =>
      (await db.query<{ id: string }>("select public.criar_empresa('Construtora M') id")).rows[0]!.id);
    const r = await como(db, "authenticated", a, () => db.query<{ email: string; papel: string }>("select * from public.membros_da_empresa($1)", [emp]));
    expect(r.rows).toEqual([expect.objectContaining({ email: "dono@exemplo.test", papel: "admin" })]);
    const f = await como(db, "authenticated", fora, () => db.query("select * from public.membros_da_empresa($1)", [emp]));
    expect(f.rows).toHaveLength(0);
  });

  it("salva itens atomicamente, bloqueia aprovação sem custo, aprova com snapshot e reabre nova versão", async () => {
    const a = await criarUsuario(db, "fluxo@exemplo.test");
    await como(db, "authenticated", a, async () => {
      const emp = (await db.query<{ id: string }>("select public.criar_empresa('Construtora F') id")).rows[0]!.id;
      const orc = (await db.query<{ id: string }>("insert into public.orcamentos (empresa_id, nome, entrada) values ($1, 'Casa', '{}') returning id", [emp])).rows[0]!.id;
      const itens = [
        { etapa: "alvenaria", chave_servico: "ALV", descricao: "Alvenaria", unidade: "M2", quantidade: "10", custo_unitario: "57.09", bdi_tipo: "servico", ordem: 1 },
        { etapa: "alvenaria", chave_servico: "ENC", descricao: "Encunhamento", unidade: "m", quantidade: "3", custo_unitario: null, bdi_tipo: "servico", ordem: 2, alerta: "sem composição" },
        { etapa: "administracao", chave_servico: "PROJETOS_TAXAS", descricao: "Projetos", unidade: "%", quantidade: "5", custo_unitario: null, bdi_tipo: "servico", ordem: 3 },
      ];
      await db.query("select public.salvar_itens_orcamento($1, $2, $3)", [orc, JSON.stringify(itens), JSON.stringify({ total: "700.50", area_construida: "100" })]);
      expect(await contar("select count(*)::int n from public.orcamento_itens where orcamento_id = $1", [orc])).toBe(3);
      await expect(db.query("select public.aprovar_orcamento($1)", [orc])).rejects.toThrow(/1 item\(ns\) sem composição/);

      await db.query("select public.salvar_itens_orcamento($1, $2, $3)", [orc, JSON.stringify([itens[0], itens[2]]), JSON.stringify({ total: "600", area_construida: "100" })]);
      await db.query("select public.salvar_cronograma($1, $2)", [orc, JSON.stringify([{ etapa: "alvenaria", mes: 1, percentual: 100 }])]);
      expect((await db.query<{ v: number }>("select public.aprovar_orcamento($1, 'ok') v", [orc])).rows[0]!.v).toBe(1);
      const snap = await db.query<{ total: string; n: number }>("select total::text, jsonb_array_length(snapshot->'itens') n from public.orcamento_versoes where orcamento_id = $1", [orc]);
      expect(snap.rows[0]).toEqual({ total: "600.00", n: 2 });
      await expect(db.query("select public.salvar_itens_orcamento($1, '[]', '{}')", [orc])).rejects.toThrow(/aprovado/);

      expect((await db.query<{ v: number }>("select public.reabrir_orcamento($1, 'ajuste') v", [orc])).rows[0]!.v).toBe(2);
      const o = await db.query<{ status: string; versao: number }>("select status, versao from public.orcamentos where id = $1", [orc]);
      expect(o.rows[0]).toEqual({ status: "rascunho", versao: 2 });
      expect(await contar("select count(*)::int n from public.orcamento_versoes where orcamento_id = $1", [orc])).toBe(1);
    });
  });

  it("leitor não salva itens", async () => {
    const dono = await criarUsuario(db, "dono2@exemplo.test");
    const leitor = await criarUsuario(db, "leitor2@exemplo.test");
    const { emp, orc } = await como(db, "authenticated", dono, async () => {
      const emp = (await db.query<{ id: string }>("select public.criar_empresa('Construtora L') id")).rows[0]!.id;
      const orc = (await db.query<{ id: string }>("insert into public.orcamentos (empresa_id, nome, entrada) values ($1, 'Casa', '{}') returning id", [emp])).rows[0]!.id;
      return { emp, orc };
    });
    await db.query("insert into public.membros (empresa_id, user_id, papel) values ($1, $2, 'leitor')", [emp, leitor.sub]);
    await expect(como(db, "authenticated", leitor, () =>
      db.query("select public.salvar_itens_orcamento($1, '[]', '{}')", [orc]))).rejects.toThrow(/Sem permissão/);
  });
});

describe("mapeamento (migration 0005)", () => {
  it("copia o mapeamento entre padrões de forma atômica, atualizando o destino sem apagar", async () => {
    const a = await criarUsuario(db, "mapa@exemplo.test");
    const [k1, k2] = [CATALOGO_SERVICOS[0]!.chave, CATALOGO_SERVICOS[1]!.chave];
    await como(db, "authenticated", a, async () => {
      const emp = (await db.query<{ id: string }>("select public.criar_empresa('Construtora P') id")).rows[0]!.id;
      const ins = "insert into public.servicos_mapeamento (empresa_id, chave, padrao, fonte, codigo, fator_conversao) values ($1, $2, $3, 'SINAPI', $4, 1)";
      await db.query(ins, [emp, k1, "normal", "C-ORIGEM-1"]);
      await db.query(ins, [emp, k2, "normal", "C-ORIGEM-2"]);
      await db.query(ins, [emp, k1, "alto", "C-ANTIGO"]);
      const n = (await db.query<{ n: number }>("select public.copiar_mapeamento_padrao($1, 'normal', 'alto') n", [emp])).rows[0]!.n;
      expect(n).toBe(2);
      const r = await db.query<{ chave: string; codigo: string }>(
        "select chave, codigo from public.servicos_mapeamento where empresa_id = $1 and padrao = 'alto' order by codigo", [emp]);
      expect(r.rows).toEqual([{ chave: k1, codigo: "C-ORIGEM-1" }, { chave: k2, codigo: "C-ORIGEM-2" }]);
      await expect(db.query("select public.copiar_mapeamento_padrao($1, 'alto', 'alto')", [emp])).rejects.toThrow(/mesmo padrão/);
    });
    const fora = await criarUsuario(db, "fora-mapa@exemplo.test");
    const emp = (await db.query<{ id: string }>("select id from public.empresas where nome = 'Construtora P'")).rows[0]!.id;
    await expect(como(db, "authenticated", fora, () =>
      db.query("select public.copiar_mapeamento_padrao($1, 'normal', 'luxo')", [emp]))).rejects.toThrow(/Sem permissão/);
  });
});

describe("endurecimento (migration 0006)", () => {
  const novoOrcamento = async (nomeEmpresa: string) => {
    const emp = (await db.query<{ id: string }>("select public.criar_empresa($1) id", [nomeEmpresa])).rows[0]!.id;
    const orc = (await db.query<{ id: string }>("insert into public.orcamentos (empresa_id, nome, entrada) values ($1, 'Casa', '{}') returning id", [emp])).rows[0]!.id;
    await db.query("insert into public.orcamento_itens (orcamento_id, descricao, quantidade, custo_unitario) values ($1, 'Item', 1, 100)", [orc]);
    return { emp, orc };
  };
  const item = { etapa: "alvenaria", chave_servico: "ALV", descricao: "Alvenaria", unidade: "M2", quantidade: "10", custo_unitario: "50", bdi_tipo: "servico", ordem: 1 };

  it("status, versão e aprovação só mudam pelas funções; o aprovado só aceita trocar nome e cliente", async () => {
    const u = await criarUsuario(db, "imutavel@exemplo.test");
    await como(db, "authenticated", u, async () => {
      const { orc } = await novoOrcamento("Construtora I");
      await expect(db.query("update public.orcamentos set status = 'aprovado' where id = $1", [orc])).rejects.toThrow(/aprovar_orcamento/);
      await expect(db.query("update public.orcamentos set versao = 7 where id = $1", [orc])).rejects.toThrow(/aprovar_orcamento/);
      await db.query("update public.orcamentos set status = 'revisao' where id = $1", [orc]);
      await db.query("select public.aprovar_orcamento($1)", [orc]);
      await expect(db.query("update public.orcamentos set status = 'rascunho' where id = $1", [orc])).rejects.toThrow(/aprovar_orcamento/);
      await expect(db.query("update public.orcamentos set aprovado_em = null where id = $1", [orc])).rejects.toThrow(/aprovar_orcamento/);
      await expect(db.query("update public.orcamentos set cub_m2 = 1, dmt = '{}' where id = $1", [orc])).rejects.toThrow(/aprovado/);
      await db.query("update public.orcamentos set nome = 'Casa Silva', cliente = 'Cliente X' where id = $1", [orc]);
    });
  });

  it("reabrir grava o motivo na versão e ninguém insere versão diretamente", async () => {
    const u = await criarUsuario(db, "versoes@exemplo.test");
    await como(db, "authenticated", u, async () => {
      const { orc } = await novoOrcamento("Construtora V");
      await db.query("select public.aprovar_orcamento($1, 'primeira')", [orc]);
      await db.query("select public.reabrir_orcamento($1, 'ajuste')", [orc]);
      const m = await db.query<{ motivo: string }>("select motivo from public.orcamento_versoes where orcamento_id = $1", [orc]);
      expect(m.rows[0]!.motivo).toBe("primeira | reaberto: ajuste");
      await expect(db.query("insert into public.orcamento_versoes (orcamento_id, versao, status, snapshot) values ($1, 9, 'aprovado', '{}')", [orc]))
        .rejects.toThrow(/aprovar_orcamento/);
    });
  });

  it("orçamento aprovado não é excluído; o reaberto (com histórico) é", async () => {
    const u = await criarUsuario(db, "excluir@exemplo.test");
    await como(db, "authenticated", u, async () => {
      const { orc } = await novoOrcamento("Construtora E");
      await db.query("select public.aprovar_orcamento($1)", [orc]);
      expect((await db.query("delete from public.orcamentos where id = $1", [orc])).affectedRows).toBe(0);
      await db.query("select public.reabrir_orcamento($1)", [orc]);
      expect((await db.query("delete from public.orcamentos where id = $1", [orc])).affectedRows).toBe(1);
    });
  });

  it("salvar_calculo grava campos, itens e cronograma numa só transação", async () => {
    const u = await criarUsuario(db, "calculo@exemplo.test");
    await como(db, "authenticated", u, async () => {
      const { orc } = await novoOrcamento("Construtora C");
      const salvar = (crono: unknown[]) => db.query("select public.salvar_calculo($1, $2, $3, $4, $5)", [
        orc, JSON.stringify([item]), JSON.stringify({ total: "500", area_construida: "80" }), JSON.stringify(crono),
        JSON.stringify({ mes_base: "2026-09-01", desonerado: true, entrada: { versao: 1, marca: "nova" } }),
      ]);
      await expect(salvar([{ etapa: "alvenaria", mes: 0, percentual: 100 }])).rejects.toThrow();
      const antes = await db.query<{ mes_base: string | null; entrada: unknown; n: number }>(
        "select mes_base::text, entrada, (select count(*)::int from public.orcamento_itens where orcamento_id = o.id and descricao = 'Item') n from public.orcamentos o where id = $1", [orc]);
      expect(antes.rows[0]).toEqual({ mes_base: null, entrada: {}, n: 1 });

      await salvar([{ etapa: "alvenaria", mes: 1, percentual: "33.333333" }, { etapa: "alvenaria", mes: 2, percentual: "66.666667" }]);
      const depois = await db.query<{ mes_base: string; desonerado: boolean; total: string; p: string }>(
        "select mes_base::text, desonerado, total::text, (select percentual::text from public.cronograma where orcamento_id = o.id and mes = 1) p from public.orcamentos o where id = $1", [orc]);
      expect(depois.rows[0]).toEqual({ mes_base: "2026-09-01", desonerado: true, total: "500.00", p: "33.333333" });
      expect(await contar("select count(*)::int n from public.orcamento_itens where orcamento_id = $1", [orc])).toBe(1);
    });
  });

  it("aceitar convite exige e-mail confirmado", async () => {
    const dono = await criarUsuario(db, "dono-conf@exemplo.test");
    const pendente = await criarUsuario(db, "pendente@exemplo.test", false);
    const token = await como(db, "authenticated", dono, async () => {
      const emp = (await db.query<{ id: string }>("select public.criar_empresa('Construtora K') id")).rows[0]!.id;
      return (await db.query<{ token: string }>("insert into public.convites (empresa_id, email, papel) values ($1, 'pendente@exemplo.test', 'admin') returning token", [emp])).rows[0]!.token;
    });
    await expect(como(db, "authenticated", pendente, () => db.query("select public.aceitar_convite($1)", [token]))).rejects.toThrow(/Confirme o seu e-mail/);
  });

  it("a empresa mantém pelo menos um administrador", async () => {
    const a = await criarUsuario(db, "unico-admin@exemplo.test");
    const b = await criarUsuario(db, "segundo-admin@exemplo.test");
    const emp = await como(db, "authenticated", a, async () => (await db.query<{ id: string }>("select public.criar_empresa('Construtora U') id")).rows[0]!.id);
    await como(db, "authenticated", a, async () => {
      await expect(db.query("update public.membros set papel = 'leitor' where empresa_id = $1 and user_id = $2", [emp, a.sub])).rejects.toThrow(/pelo menos um administrador/);
      await expect(db.query("delete from public.membros where empresa_id = $1 and user_id = $2", [emp, a.sub])).rejects.toThrow(/pelo menos um administrador/);
    });
    await db.query("insert into public.membros (empresa_id, user_id, papel) values ($1, $2, 'admin')", [emp, b.sub]);
    await como(db, "authenticated", a, () => db.query("delete from public.membros where empresa_id = $1 and user_id = $2", [emp, a.sub]));
    expect(await contar("select count(*)::int n from public.membros where empresa_id = $1", [emp])).toBe(1);
  });
});
