/**
 * Gera supabase/seed.sql a partir dos valores-semente do motor (índices, padrões, tabelas, catálogo)
 * e das faixas de BDI do TCU. NÃO gera mapeamento com códigos SINAPI/SICRO: a empresa vincula cada
 * chave em Configurações → Mapeamento (nunca inventar códigos).
 *
 * Uso: npx tsx tools/gerar-seed.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATALOGO_SERVICOS } from "../src/lib/engine/catalogo";
import { INDICES_PADRAO } from "../src/lib/engine/indices";
import { PADROES_ACABAMENTO } from "../src/lib/engine/padroes";
import { TABELAS_PADRAO } from "../src/lib/engine/tabelas";

const txt = (v: string | null): string => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
const json = (v: unknown): string => `${txt(JSON.stringify(v))}::jsonb`;

/** Faixas do Acórdão TCU 2622/2013 (percentuais). Conferir com o acórdão antes de usar em licitação. */
const FAIXAS_TCU: ReadonlyArray<[string, string, string, string, string]> = [
  ["edificacoes", "ac", "3.00", "4.00", "5.50"],
  ["edificacoes", "s_g", "0.80", "0.80", "1.00"],
  ["edificacoes", "r", "0.97", "1.27", "1.27"],
  ["edificacoes", "df", "0.59", "1.23", "1.39"],
  ["edificacoes", "l", "6.16", "7.40", "8.96"],
  ["edificacoes", "bdi", "20.34", "22.12", "25.00"],
  ["fornecimento_materiais", "ac", "1.50", "3.45", "4.49"],
  ["fornecimento_materiais", "s_g", "0.30", "0.48", "0.82"],
  ["fornecimento_materiais", "r", "0.56", "0.85", "0.89"],
  ["fornecimento_materiais", "df", "0.85", "0.85", "1.11"],
  ["fornecimento_materiais", "l", "3.50", "5.11", "6.22"],
  ["fornecimento_materiais", "bdi", "11.10", "14.02", "16.80"],
];

/** BDI global inicial (frações). I = PIS 0,65% + COFINS 3% + ISS 3% — ajustar o ISS do município. */
const BDI_PADRAO = [
  { id: "00000000-0000-4000-8000-000000000001", nome: "BDI serviços (padrão inicial)", tipo: "servico", obra: "edificacoes", ac: "0.04", s: "0.004", g: "0.004", r: "0.0127", df: "0.0123", l: "0.074", i: "0.0665" },
  { id: "00000000-0000-4000-8000-000000000002", nome: "BDI materiais (padrão inicial)", tipo: "material", obra: "fornecimento_materiais", ac: "0.0345", s: "0.0024", g: "0.0024", r: "0.0085", df: "0.0085", l: "0.0511", i: "0.0665" },
] as const;

function linhas(): string[] {
  const out: string[] = [
    "-- GERADO por tools/gerar-seed.ts — não editar à mão. Valores-semente globais (empresa_id null).",
    "-- Sem códigos SINAPI/SICRO: o mapeamento é feito pela empresa em Configurações → Mapeamento.",
    "begin;",
    "",
    "insert into public.servicos_catalogo (chave, descricao, unidade, etapa, ordem, bdi_tipo) values",
    CATALOGO_SERVICOS.map((s) => `  (${txt(s.chave)}, ${txt(s.descricao)}, ${txt(s.unidade)}, ${txt(s.etapa)}, ${s.ordem}, ${txt(s.bdi)})`).join(",\n"),
    "on conflict (chave) do update set descricao = excluded.descricao, unidade = excluded.unidade, etapa = excluded.etapa,",
    "  ordem = excluded.ordem, bdi_tipo = excluded.bdi_tipo;",
    "",
    "insert into public.indices_parametricos (empresa_id, chave, valor, unidade, descricao, origem) values",
    INDICES_PADRAO.map((d) => `  (null, ${txt(d.chave)}, ${d.valor}, ${txt(d.unidade)}, ${txt(d.descricao)}, ${txt(d.origem)})`).join(",\n"),
    "on conflict (empresa_id, chave) do update set valor = excluded.valor, unidade = excluded.unidade,",
    "  descricao = excluded.descricao, origem = excluded.origem;",
    "",
    "insert into public.padroes_acabamento (empresa_id, padrao, config) values",
    Object.entries(PADROES_ACABAMENTO).map(([p, c]) => `  (null, ${txt(p)}, ${json(c)})`).join(",\n"),
    "on conflict (empresa_id, padrao) do update set config = excluded.config;",
    "",
    "insert into public.tabelas_parametricas (empresa_id, chave, config) values",
    Object.entries(TABELAS_PADRAO).map(([k, v]) => `  (null, ${txt(k)}, ${json(v)})`).join(",\n"),
    "on conflict (empresa_id, chave) do update set config = excluded.config;",
    "",
    "insert into public.bdi_faixas (tipo_obra, componente, minimo, medio, maximo, origem) values",
    FAIXAS_TCU.map(([o, c, mi, me, ma]) => `  (${txt(o)}, ${txt(c)}, ${mi}, ${me}, ${ma}, 'Acórdão TCU 2622/2013 (conferir)')`).join(",\n"),
    "on conflict (tipo_obra, componente) do update set minimo = excluded.minimo, medio = excluded.medio,",
    "  maximo = excluded.maximo, origem = excluded.origem;",
    "",
    "insert into public.bdi_config (id, empresa_id, nome, tipo_obra, ac, s, r, g, df, l, i, tipo) values",
    BDI_PADRAO.map((b) => `  (${txt(b.id)}, null, ${txt(b.nome)}, ${txt(b.obra)}, ${b.ac}, ${b.s}, ${b.r}, ${b.g}, ${b.df}, ${b.l}, ${b.i}, ${txt(b.tipo)})`).join(",\n"),
    "on conflict (id) do update set nome = excluded.nome, tipo_obra = excluded.tipo_obra, ac = excluded.ac, s = excluded.s,",
    "  r = excluded.r, g = excluded.g, df = excluded.df, l = excluded.l, i = excluded.i, tipo = excluded.tipo;",
    "",
    "commit;",
    "",
  ];
  return out;
}

const destino = resolve(import.meta.dirname, "../supabase/seed.sql");
writeFileSync(destino, linhas().join("\n"), "utf8");
process.stdout.write(`seed gerado: ${destino}\n`);
