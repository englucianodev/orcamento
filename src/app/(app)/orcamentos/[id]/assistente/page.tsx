import Link from "next/link";
import { notFound } from "next/navigation";
import { Assistente } from "@/components/wizard/assistente";
import type { BaseDisponivel } from "@/components/wizard/etapas-obra";
import type { OpcaoBdi } from "@/components/wizard/etapas-finais";
import { valoresIniciais } from "@/components/wizard/valores";
import { exigirEmpresa, podeEditar } from "@/lib/empresa";
import { taxaBdi, type LinhaBdi } from "@/lib/orcamento/config";

export const metadata = { title: "Assistente · ORÇAOBRA" };

export default async function PaginaAssistente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, empresas } = await exigirEmpresa();
  const { data: orc, error } = await supabase.from("orcamentos")
    .select("id, empresa_id, nome, status, entrada, etapa_assistente, mes_base_sicro, cub_m2, responsavel, dmt, bdi_servico_id, bdi_material_id")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Orçamento: ${error.message}`);
  if (!orc) notFound();

  const empresaId = orc.empresa_id as string;
  const [basesR, bdiR, indicesR] = await Promise.all([
    supabase.from("bases_referencia").select("fonte, uf, mes_ano, desonerado").not("importado_em", "is", null),
    supabase.from("bdi_config").select("id, nome, tipo, tipo_obra, ac, s, r, g, df, l, i, empresa_id").or(`empresa_id.is.null,empresa_id.eq.${empresaId}`),
    supabase.from("indices_parametricos").select("empresa_id, chave, valor").or(`empresa_id.is.null,empresa_id.eq.${empresaId}`),
  ]);
  for (const r of [basesR, bdiR, indicesR]) if (r.error) throw new Error(r.error.message);

  const indices: Record<string, string> = {};
  const linhasIndice = (indicesR.data ?? []) as Array<{ empresa_id: string | null; chave: string; valor: string | number }>;
  // globais primeiro, depois os da empresa sobrescrevem
  for (const l of [...linhasIndice].sort((a, b) => Number(a.empresa_id !== null) - Number(b.empresa_id !== null))) indices[l.chave] = String(l.valor);

  const bdis: OpcaoBdi[] = ((bdiR.data ?? []) as Array<LinhaBdi & { empresa_id: string | null }>).map((b) => ({
    id: b.id, nome: b.nome, tipo: b.tipo, taxa: taxaBdi(b).toFixed(6), daEmpresa: b.empresa_id !== null,
  }));

  const papel = empresas.find((e) => e.id === empresaId)?.papel;
  const somenteLeitura = orc.status === "aprovado"
    ? "Orçamento aprovado: o assistente está em modo leitura. Reabra o orçamento para criar uma nova versão."
    : !papel || !podeEditar(papel) ? "Seu papel nesta empresa é leitor: o assistente está em modo leitura." : null;

  const meta = {
    mes_base_sicro: orc.mes_base_sicro, cub_m2: orc.cub_m2 === null ? null : Number(orc.cub_m2),
    responsavel: orc.responsavel ?? undefined, dmt: orc.dmt ?? undefined,
    bdi_servico_id: orc.bdi_servico_id, bdi_material_id: orc.bdi_material_id,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-suave"><Link href="/painel" className="hover:underline">Orçamentos</Link> / Assistente</p>
          <h1 className="text-xl font-semibold">{orc.nome as string}</h1>
        </div>
        <Link href={`/orcamentos/${id}`} className="text-sm text-acento hover:underline">Ver planilha do orçamento →</Link>
      </div>
      <Assistente
        orcamentoId={id}
        inicial={valoresIniciais(orc.entrada, meta)}
        passoInicial={Number(orc.etapa_assistente) || 1}
        bases={(basesR.data ?? []) as BaseDisponivel[]}
        bdis={bdis}
        indices={indices}
        somenteLeitura={somenteLeitura}
      />
    </div>
  );
}
