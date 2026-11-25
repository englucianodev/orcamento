/** Orçamento fictício e anonimizado para os testes dos relatórios (nenhum dado real de cliente). */
import { D } from "@/lib/engine/decimal";
import { calcularOrcamento } from "@/lib/engine/orcamento";
import type { DadosOrcamento, ItemDb } from "@/lib/orcamento/carregar";
import { taxaBdi, type LinhaBdi, type LinhaFaixa } from "@/lib/orcamento/config";
import type { Fechamento } from "@/lib/orcamento/fechamento";
import { entrada, quartoAceite } from "./entrada-exemplo";

const BDI_SERVICO: LinhaBdi = {
  id: "bdi-s", nome: "BDI serviços teste", tipo: "servico", tipo_obra: "edificacoes",
  ac: "0.04", s: "0.004", r: "0.0127", g: "0.004", df: "0.0123", l: "0.074", i: "0.0665",
};
const BDI_MATERIAL: LinhaBdi = {
  id: "bdi-m", nome: "BDI materiais teste", tipo: "material", tipo_obra: "fornecimento_materiais",
  ac: "0.0345", s: "0.0024", r: "0.0085", g: "0.0024", df: "0.0085", l: "0.0511", i: "0.0665",
};

export const FAIXAS: LinhaFaixa[] = [
  { tipo_obra: "edificacoes", componente: "ac", minimo: "3.00", medio: "4.00", maximo: "5.50" },
  { tipo_obra: "edificacoes", componente: "l", minimo: "6.16", medio: "7.40", maximo: "8.96" },
  { tipo_obra: "edificacoes", componente: "bdi", minimo: "20.34", medio: "22.12", maximo: "25.00" },
  { tipo_obra: "fornecimento_materiais", componente: "ac", minimo: "1.50", medio: "3.45", maximo: "3.00" },
];

function item(p: Partial<ItemDb> & Pick<ItemDb, "id" | "etapa" | "descricao" | "unidade" | "quantidade">): ItemDb {
  return {
    numero: null, chave_servico: null, ambiente_id: null, fonte: null, codigo: null, quantidade_calculada: null,
    memoria_calculo: null, fator_conversao: "1", custo_unitario: null, editado_manual: false, bdi_tipo: "servico",
    alerta: null, ordem: 0, ...p,
  };
}

export function itensFixture(): ItemDb[] {
  return [
    item({ id: "i1", etapa: "preliminares", numero: "1.1", fonte: "SINAPI", codigo: "1001", descricao: "Locação da obra", unidade: "m2", quantidade: "100", custo_unitario: "10", memoria_calculo: "10 × 10 = 100", ordem: 1 }),
    item({ id: "i2", etapa: "alvenaria", numero: "5.1", fonte: "SINAPI", codigo: "2002", descricao: "Alvenaria de vedação", unidade: "m2", quantidade: "50", custo_unitario: "80", ambiente_id: "sala", memoria_calculo: "perímetro × pé-direito − vãos", ordem: 2 }),
    item({ id: "i3", etapa: "revestimentos", numero: "7.1", fonte: "SICRO", codigo: "3003", descricao: "Contrapiso", unidade: "m2", quantidade: "20", custo_unitario: "30", ambiente_id: "q1", ordem: 3 }),
    item({ id: "i4", etapa: "revestimentos", numero: "7.2", fonte: "PROPRIA", codigo: "X1", descricao: "Piso especial", unidade: "m2", quantidade: "10", custo_unitario: null, ambiente_id: "q1", alerta: "Sem composição mapeada", ordem: 4 }),
    item({ id: "i6", etapa: "pintura", numero: "14.1", fonte: "SINAPI", codigo: "4004", descricao: "Tinta látex", unidade: "L", quantidade: "200", custo_unitario: "1.5", ambiente_id: "sala", bdi_tipo: "material", ordem: 5 }),
    item({ id: "i5", etapa: "administracao", numero: "19.1", descricao: "Administração local", unidade: "%", quantidade: "5", ordem: 6 }),
  ];
}

export const FECHAMENTO_SINAPI: Fechamento = {
  composicoes: [
    { codigo: "1001", descricao: "LOCAÇÃO DE OBRA (FICTÍCIA)", unidade: "M2", grupo: null, preco_publicado: "10.00", producao_equipe: null, fic: null },
    { codigo: "2002", descricao: "ALVENARIA (FICTÍCIA)", unidade: "M2", grupo: null, preco_publicado: "80.00", producao_equipe: null, fic: null },
    { codigo: "9001", descricao: "ARGAMASSA (AUXILIAR FICTÍCIA)", unidade: "M3", grupo: null, preco_publicado: null, producao_equipe: null, fic: null },
  ],
  itens: [
    { composicao_codigo: "1001", tipo_item: "INSUMO", item_codigo: "I1", coeficiente: "0.5", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
    { composicao_codigo: "1001", tipo_item: "INSUMO", item_codigo: "I2", coeficiente: "2", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
    { composicao_codigo: "2002", tipo_item: "COMPOSICAO", item_codigo: "9001", coeficiente: "1", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
    { composicao_codigo: "9001", tipo_item: "INSUMO", item_codigo: "I1", coeficiente: "8", utilizacao_operativa: null, utilizacao_improdutiva: null, grupo_sicro: null, extra: null },
  ],
  insumos: [
    { codigo: "I1", descricao: "SERVENTE (FICTÍCIO)", unidade: "H", tipo: null, preco: "10.00", origem_preco: null, chp: null, chi: null },
    { codigo: "I2", descricao: "PONTALETE (FICTÍCIO)", unidade: "M", tipo: null, preco: "2.50", origem_preco: null, chp: null, chi: null },
  ],
};

export function dadosFixture(opcoes: { cub?: string | null; responsavel?: DadosOrcamento["orcamento"]["responsavel"] } = {}): DadosOrcamento {
  const itens = itensFixture();
  const bdi = { servico: BDI_SERVICO, material: BDI_MATERIAL, taxaServico: taxaBdi(BDI_SERVICO), taxaMaterial: taxaBdi(BDI_MATERIAL) };
  const cub = opcoes.cub ?? null;
  const ent = entrada([{ ...quartoAceite(), id: "sala", nome: "Sala" }, quartoAceite()]);
  const resultado = calcularOrcamento(
    itens.map((i) => ({ id: i.id, etapa: i.etapa, quantidade: i.quantidade, custoUnitario: i.custo_unitario, bdiTipo: i.bdi_tipo, percentual: i.unidade === "%" })),
    { bdiServico: bdi.taxaServico, bdiMaterial: bdi.taxaMaterial, areaConstruida: new D("60"), cubM2: cub ? new D(cub) : null },
  );
  return {
    orcamento: {
      id: "00000000-0000-4000-8000-0000000000aa", empresa_id: "emp", nome: "Residência Exemplo", cliente: "Cliente Fictício",
      uf: "PI", mes_base: "2026-10-01", mes_base_sicro: "2026-07-01", desonerado: false, padrao: "normal", entrada: ent,
      etapa_assistente: 9, status: "rascunho", versao: 2, bdi_servico_id: "bdi-s", bdi_material_id: "bdi-m",
      cub_m2: cub, area_construida: "60", dmt: { ln: 0, rp: 0, p: 0 }, responsavel: opcoes.responsavel ?? null,
      total: null, aprovado_em: null, criado_em: "2026-11-01T00:00:00Z", atualizado_em: "2026-11-01T00:00:00Z",
    },
    itens,
    empresa: { id: "emp", nome: "Construtora Exemplo Ltda", cnpj: null, logo_path: null },
    bdi,
    resultado,
    cronograma: [
      { etapa: "preliminares", mes: 1, percentual: "100.000" },
      { etapa: "alvenaria", mes: 1, percentual: "50.000" },
      { etapa: "alvenaria", mes: 2, percentual: "50.000" },
      { etapa: "revestimentos", mes: 2, percentual: "33.333" },
      { etapa: "revestimentos", mes: 3, percentual: "66.667" },
      { etapa: "pintura", mes: 3, percentual: "100.000" },
      { etapa: "administracao", mes: 1, percentual: "33.333" },
      { etapa: "administracao", mes: 2, percentual: "33.333" },
      { etapa: "administracao", mes: 3, percentual: "33.333" },
    ],
    bases: {
      sinapi: { id: "base-sinapi", fonte: "SINAPI", uf: "PI", mesAno: "2026-10-01", desonerado: false, rotulo: "SINAPI PI 10/2026 não desonerado" },
      sicro: { id: "base-sicro", fonte: "SICRO", uf: "PI", mesAno: "2026-07-01", desonerado: false, rotulo: "SICRO PI 07/2026 não desonerado" },
      avisos: ["Atenção: datas-base diferentes — SINAPI 10/2026 e SICRO 07/2026."],
    },
  };
}
