import type { Metadata } from "next";
import { FormularioPadrao } from "@/components/configuracoes/formulario-padrao";
import { rotuloOpcao } from "@/components/configuracoes/rotulos";
import { Alerta, Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { PADROES, type Padrao } from "@/lib/engine/entrada.schema";
import { PADROES_ACABAMENTO, type ConfigPadrao } from "@/lib/engine/padroes";
import { contextoPagina } from "../contexto";

export const metadata: Metadata = { title: "Padrões de acabamento" };

interface LinhaPadrao { empresa_id: string | null; padrao: string; config: unknown }

const ehObjeto = (v: unknown): v is Partial<ConfigPadrao> => typeof v === "object" && v !== null && !Array.isArray(v);

function efetivo(padrao: Padrao, linhas: readonly LinhaPadrao[], empresaId: string): ConfigPadrao {
  const global = linhas.find((l) => l.padrao === padrao && l.empresa_id === null)?.config;
  const daEmpresa = linhas.find((l) => l.padrao === padrao && l.empresa_id === empresaId)?.config;
  return { ...PADROES_ACABAMENTO[padrao], ...(ehObjeto(global) ? global : {}), ...(ehObjeto(daEmpresa) ? daEmpresa : {}) };
}

const RESUMO: ReadonlyArray<[keyof ConfigPadrao, string]> = [
  ["pisoSeco", "Piso seco"], ["pisoMolhado", "Piso molhado"], ["pintura", "Pintura"], ["forroSeco", "Forro"],
  ["janela", "Esquadrias"], ["portaInterna", "Portas internas"],
];

export default async function PaginaPadroes() {
  const { supabase, atual, editor } = await contextoPagina();
  const { data, error } = await supabase.from("padroes_acabamento").select("empresa_id, padrao, config")
    .or(`empresa_id.is.null,empresa_id.eq.${atual.id}`);
  const linhas = (data ?? []) as LinhaPadrao[];

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alerta tom="perigo">Não foi possível carregar os padrões: {error.message}</Alerta> : null}
      <Alerta tom="info">
        Estes acabamentos são sugeridos ao criar ambientes no assistente. O serviço concreto (e seu preço) vem do
        mapeamento por padrão em Configurações → Mapeamento.
        {!editor ? " Seu acesso é somente leitura." : ""}
      </Alerta>
      {PADROES.map((p) => {
        const cfg = efetivo(p, linhas, atual.id);
        const personalizado = linhas.some((l) => l.padrao === p && l.empresa_id === atual.id);
        return (
          <Card key={p}>
            <CardHeader
              titulo={`Padrão ${cfg.rotulo}`}
              acoes={personalizado ? <Badge tom="info">Personalizado pela empresa</Badge> : <Badge>Global</Badge>}
            />
            <CardBody>
              {editor ? (
                <FormularioPadrao padrao={p} config={cfg} personalizado={personalizado} />
              ) : (
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {RESUMO.map(([k, rotulo]) => (
                    <div key={k}><dt className="text-xs text-suave">{rotulo}</dt><dd>{rotuloOpcao(String(cfg[k]))}</dd></div>
                  ))}
                  <div><dt className="text-xs text-suave">Bancadas</dt><dd>{cfg.bancadas}</dd></div>
                  <div><dt className="text-xs text-suave">Louças e metais</dt><dd>{cfg.loucasMetais}</dd></div>
                  <div><dt className="text-xs text-suave">Multiplicador de pontos</dt><dd>{cfg.multiplicadorPontos}</dd></div>
                </dl>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
