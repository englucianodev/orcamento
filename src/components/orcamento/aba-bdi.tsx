/** Aba BDI e encargos (servidor): componentes do BDI (TCU), faixas de referência e encargos da base. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { Alerta, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { verificarFaixasBdi } from "@/lib/engine/bdi";
import { faixasDoBanco, parametrosBdi, taxaBdi, type LinhaBdi, type LinhaFaixa } from "@/lib/orcamento/config";
import type { DadosOrcamento } from "@/lib/orcamento/carregar";
import { numero } from "@/lib/utils";
import { FormularioBdi, type OpcaoBdiForm } from "./formularios";

const COMPONENTES: Array<[keyof ReturnType<typeof parametrosBdi>, string]> = [
  ["ac", "Administração central (AC)"], ["s", "Seguro (S)"], ["r", "Risco (R)"], ["g", "Garantia (G)"],
  ["df", "Despesas financeiras (DF)"], ["l", "Lucro (L)"], ["i", "Tributos (I)"],
];
const pct = (v: string | number) => `${numero(Number(v) * 100, 2)}%`;

function QuadroBdi({ titulo, b, faixas }: { titulo: string; b: LinhaBdi | null; faixas: LinhaFaixa[] }) {
  if (!b) return <Alerta tom="aviso" titulo={`${titulo}: nenhum BDI configurado`}>Cadastre em Configurações → BDI.</Alerta>;
  const p = parametrosBdi(b);
  const alertas = verificarFaixasBdi(p, faixasDoBanco(faixas, b.tipo_obra));
  return (
    <Card>
      <CardHeader titulo={`${titulo}: ${pct(taxaBdi(b).toFixed(6))}`} descricao={`${b.nome} · tipo de obra: ${b.tipo_obra}`} />
      <CardBody className="space-y-3">
        <Tabela>
          <thead><tr><Th>Componente</Th><Th numerico>Taxa</Th></tr></thead>
          <tbody>{COMPONENTES.map(([k, r]) => <tr key={k}><Td>{r}</Td><Td numerico>{pct(String(p[k]))}</Td></tr>)}</tbody>
        </Tabela>
        <p className="font-mono text-xs text-suave">BDI = ((1+AC+S+R+G)(1+DF)(1+L)/(1−I)) − 1</p>
        {alertas.length ? (
          <Alerta tom="aviso" titulo="Fora das faixas de referência">
            <ul className="list-disc pl-5">{alertas.map((a) => <li key={a.componente}>{a.mensagem}</li>)}</ul>
          </Alerta>
        ) : <Alerta tom="sucesso">Dentro das faixas de referência cadastradas.</Alerta>}
      </CardBody>
    </Card>
  );
}

export async function AbaBdi({ supabase, dados, editavel }: { supabase: SupabaseClient; dados: DadosOrcamento; editavel: boolean }) {
  const o = dados.orcamento;
  const [faixasR, opcoesR, encargosR] = await Promise.all([
    supabase.from("bdi_faixas").select("tipo_obra, componente, minimo, medio, maximo"),
    supabase.from("bdi_config").select("id, nome, tipo, tipo_obra, ac, s, r, g, df, l, i, empresa_id").or(`empresa_id.is.null,empresa_id.eq.${o.empresa_id}`),
    dados.bases.sinapi ? supabase.from("encargos_sociais").select("horista_pct, mensalista_pct").eq("base_id", dados.bases.sinapi.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [faixasR, opcoesR, encargosR]) if (r.error) throw new Error(r.error.message);
  const faixas = (faixasR.data ?? []) as LinhaFaixa[];
  const opcoes: OpcaoBdiForm[] = ((opcoesR.data ?? []) as Array<LinhaBdi & { empresa_id: string | null }>).map((b) => ({
    id: b.id, tipo: b.tipo, rotulo: `${b.nome} — ${pct(taxaBdi(b).toFixed(6))}${b.empresa_id ? "" : " (padrão)"}`,
  }));
  const enc = encargosR.data as { horista_pct: string | null; mensalista_pct: string | null } | null;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader titulo="BDI aplicado" descricao="Itens de serviço usam o BDI de serviços; materiais/equipamentos de fornecimento usam o BDI diferenciado." />
        <CardBody>
          <FormularioBdi orcamentoId={o.id} opcoes={opcoes} servicoId={o.bdi_servico_id} materialId={o.bdi_material_id} desabilitado={!editavel || o.status === "aprovado"} />
        </CardBody>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <QuadroBdi titulo="BDI de serviços" b={dados.bdi.servico} faixas={faixas} />
        <QuadroBdi titulo="BDI de materiais" b={dados.bdi.material} faixas={faixas} />
      </div>
      <Card>
        <CardHeader titulo="Encargos sociais" descricao={dados.bases.sinapi ? `Da base ${dados.bases.sinapi.rotulo}` : "Sem base SINAPI selecionada."} />
        <CardBody>
          {enc ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="text-xs text-suave">Horista</dt><dd className="font-mono">{enc.horista_pct === null ? "—" : `${numero(enc.horista_pct, 2)}%`}</dd></div>
              <div><dt className="text-xs text-suave">Mensalista</dt><dd className="font-mono">{enc.mensalista_pct === null ? "—" : `${numero(enc.mensalista_pct, 2)}%`}</dd></div>
            </dl>
          ) : <p className="text-sm text-suave">A base importada não trouxe os percentuais de encargos sociais.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
