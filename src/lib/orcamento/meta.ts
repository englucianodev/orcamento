/**
 * Dados do orçamento que não fazem parte da descrição da obra (entrada do motor): data-base SICRO,
 * CUB de referência, responsável técnico, DMT e BDI escolhidos. Validado no navegador e no servidor.
 */
import { z } from "zod";

const mes = z.string().regex(/^\d{4}-\d{2}-01$/, "Mês-base inválido.");
const distancia = z.number().min(0, "Distância negativa.").max(1000, "Distância acima de 1.000 km.");

export const metaSchema = z.object({
  mes_base_sicro: mes.nullable().default(null),
  cub_m2: z.number().min(0).max(100_000).nullable().default(null),
  responsavel: z.object({
    nome: z.string().trim().max(120).default(""),
    registro: z.string().trim().max(40).default(""),
    art: z.string().trim().max(40).default(""),
  }).default({ nome: "", registro: "", art: "" }),
  dmt: z.object({ ln: distancia, rp: distancia, p: distancia }).default({ ln: 0, rp: 0, p: 0 }),
  bdi_servico_id: z.string().uuid().nullable().default(null),
  bdi_material_id: z.string().uuid().nullable().default(null),
});
export type MetaOrcamento = z.infer<typeof metaSchema>;

export const META_VAZIA: MetaOrcamento = metaSchema.parse({});
