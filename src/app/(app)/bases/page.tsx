import type { Metadata } from "next";
import { z } from "zod";
import { Alerta } from "@/components/ui/card";
import { exigirUsuario } from "@/lib/supabase/servidor";
import { ConsultaBases } from "./consulta";
import { codigoSchema, type BaseOpcao } from "./dados";

export const metadata: Metadata = { title: "Bases" };

type Parametros = Record<string, string | string[] | undefined>;

const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Link direto (ex.: aba Composições do orçamento): ?base=<uuid>&composicao=<código> ou ?fonte=PROPRIA. */
const linkSchema = z.object({
  base: z.string().uuid().optional().catch(undefined),
  composicao: codigoSchema.optional().catch(undefined),
  fonte: z.enum(["SINAPI", "SICRO", "PROPRIA"]).optional().catch(undefined),
});

export default async function PaginaBases({ searchParams }: { searchParams: Promise<Parametros> }) {
  const params = await searchParams;
  const link = linkSchema.parse({
    base: primeiro(params.base), composicao: primeiro(params.composicao), fonte: primeiro(params.fonte),
  });
  const { supabase } = await exigirUsuario();
  const { data, error } = await supabase.from("bases_referencia")
    .select("id, fonte, uf, mes_ano, desonerado")
    .not("importado_em", "is", null)
    .order("mes_ano", { ascending: false }).order("fonte").order("uf");
  const bases = (data ?? []) as BaseOpcao[];
  const baseDoLink = link.base && bases.some((b) => b.id === link.base) ? link.base : null;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alerta tom="perigo">Não foi possível carregar as bases. Recarregue a página.</Alerta> : null}
      {link.fonte === "PROPRIA" ? (
        <Alerta tom="info" titulo={link.composicao ? `Composição própria ${link.composicao}` : "Composição própria"}>
          Composições próprias da empresa têm custo informado e não possuem abertura analítica oficial (SINAPI/SICRO).
        </Alerta>
      ) : null}
      {link.base && !baseDoLink && !error ? (
        <Alerta tom="aviso">A base do link não foi encontrada ou ainda não terminou de ser importada.</Alerta>
      ) : null}
      <ConsultaBases bases={bases} baseInicial={baseDoLink} composicaoInicial={baseDoLink ? (link.composicao ?? null) : null} />
    </div>
  );
}
