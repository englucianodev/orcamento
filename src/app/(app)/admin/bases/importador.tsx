"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alerta, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Campo, Checkbox, Input, Select } from "@/components/ui/form";
import { UFS } from "@/lib/engine/entrada.schema";
import { contarLotesPorEtapa, montarLotes, type EstadoImportacao, type Lote } from "@/lib/importacao/lotes";
import type { BaseImportada } from "@/lib/importacao/parsers/tipos";
import { ROTULO_ETAPA_LEITURA, type EtapaLeitura, type MensagemDoWorker, type PedidoLeitura } from "@/lib/importacao/protocolo";
import { validacaoParaArmazenar, type ValidacaoArmazenada } from "@/lib/importacao/validacao";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { mensagemDeErro, mesAno, numero } from "@/lib/utils";
import { chamarRota, enviarLotes, enviarOriginais } from "./envio";
import { BarrasProgresso, CabecalhosEncontrados, ListaAvisos, RelatorioValidacao, type ItemProgresso } from "./relatorio";

const TAMANHO_MAX_ARQUIVO = 200 * 1024 * 1024;

const escolhaSchema = z.object({
  fonte: z.enum(["SINAPI", "SICRO"]),
  uf: z.enum(UFS),
  desonerado: z.boolean(),
  arquivos: z.array(z.instanceof(File)).min(1, "Selecione o arquivo oficial (.xlsx ou .zip).").max(50, "No máximo 50 arquivos.")
    .refine((l) => l.every((f) => /\.(xlsx|zip)$/i.test(f.name)), "Envie apenas arquivos .xlsx ou .zip.")
    .refine((l) => l.every((f) => f.size <= TAMANHO_MAX_ARQUIVO), "Cada arquivo deve ter no máximo 200 MB."),
});
type Escolha = z.infer<typeof escolhaSchema>;

interface Leitura {
  escolha: Escolha;
  hash: string;
  base: BaseImportada;
  validacao: ValidacaoArmazenada;
  lotes: Lote[];
  estado: EstadoImportacao;
}

type Fase = "escolha" | "lendo" | "lido" | "gravando" | "concluida";
const ROTULO_LOTE = { insumos: "Insumos", equipamentos: "Equipamentos (custo horário)", composicoes: "Composições", itens: "Itens das composições" } as const;

function lerNoWorker(pedido: PedidoLeitura, aoProgredir: (e: EtapaLeitura) => void, registrar: (w: Worker | null) => void) {
  return new Promise<Extract<MensagemDoWorker, { tipo: "concluido" }>>((resolver, rejeitar) => {
    const worker = new Worker(new URL("../../../../lib/importacao/worker.ts", import.meta.url), { type: "module" });
    registrar(worker);
    const encerrar = () => { worker.terminate(); registrar(null); };
    worker.onmessage = (ev: MessageEvent<MensagemDoWorker>) => {
      const msg = ev.data;
      if (msg.tipo === "progresso") return aoProgredir(msg.etapa);
      encerrar();
      if (msg.tipo === "concluido") resolver(msg);
      else rejeitar(Object.assign(new Error(msg.mensagem), { cabecalhos: msg.cabecalhos ?? [] }));
    };
    worker.onerror = () => { encerrar(); rejeitar(new Error("O leitor de planilhas falhou (memória insuficiente ou arquivo corrompido).")); };
    worker.postMessage(pedido);
  });
}

export function Importador() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("escolha");
  const [erro, setErro] = useState<string | null>(null);
  const [cabecalhos, setCabecalhos] = useState<string[][]>([]);
  const [etapasLidas, setEtapasLidas] = useState<EtapaLeitura[]>([]);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [gravados, setGravados] = useState(0);
  const [passo, setPasso] = useState<"arquivos" | "lotes" | "finalizar" | null>(null);
  const worker = useRef<Worker | null>(null);
  const interromper = useRef(false);

  useEffect(() => () => worker.current?.terminate(), []);

  async function ler(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const escolha = escolhaSchema.safeParse({
      fonte: form.get("fonte"), uf: form.get("uf"), desonerado: form.get("desonerado") === "on",
      arquivos: form.getAll("arquivos").filter((f) => f instanceof File && f.size > 0),
    });
    setErro(null); setCabecalhos([]); setLeitura(null); setEtapasLidas([]);
    if (!escolha.success) return setErro(escolha.error.issues[0]?.message ?? "Dados inválidos.");
    setFase("lendo");
    try {
      const { fonte, uf, desonerado, arquivos } = escolha.data;
      const r = await lerNoWorker(
        { tipo: "ler", arquivos, fonte, uf, desonerado },
        (e) => setEtapasLidas((l) => (l.includes(e) ? l : [...l, e])),
        (w) => { worker.current = w; },
      );
      const lotes = montarLotes(r.base);
      if (!lotes.length) throw new Error("Nenhum insumo ou composição encontrado nos arquivos.");
      const estado = await chamarRota<EstadoImportacao>({
        acao: "estado", fonte, uf, desonerado, mesAno: r.base.mesAno, hash: r.hash,
      });
      setLeitura({ escolha: escolha.data, hash: r.hash, base: r.base, validacao: validacaoParaArmazenar(r.validacao), lotes, estado });
      setGravados(estado.loteAtual);
      setFase("lido");
    } catch (e) {
      const cab = (e as { cabecalhos?: unknown }).cabecalhos;
      if (Array.isArray(cab)) setCabecalhos(cab as string[][]);
      setErro(mensagemDeErro(e));
      setFase("escolha");
    }
  }

  async function gravar() {
    if (!leitura) return;
    const { escolha, base, hash, lotes, validacao } = leitura;
    interromper.current = false;
    setErro(null); setFase("gravando");
    try {
      const id = { fonte: escolha.fonte, uf: escolha.uf, desonerado: escolha.desonerado, mesAno: base.mesAno, hash };
      setPasso("arquivos");
      const caminhos = await enviarOriginais(criarClienteNavegador(), id, escolha.arquivos);
      const estado = await chamarRota<EstadoImportacao>({
        acao: "iniciar", ...id, layout: base.layout, arquivos: caminhos,
        avisos: base.avisos.slice(0, 500).map((a) => a.slice(0, 1000)), totalLotes: lotes.length,
      });
      if (estado.situacao !== "concluida") {
        if (!estado.importacaoId) throw new Error("O servidor não abriu a importação.");
        setPasso("lotes"); setGravados(estado.loteAtual);
        await enviarLotes(estado.importacaoId, lotes, estado.loteAtual, (e) => setGravados(e.loteAtual), () => interromper.current);
        setPasso("finalizar");
        await chamarRota<EstadoImportacao>({
          acao: "finalizar", importacaoId: estado.importacaoId, validacao,
          encargos: { horistaPct: base.encargos.horistaPct, mensalistaPct: base.encargos.mensalistaPct },
        });
      }
      setFase("concluida");
      router.refresh();
    } catch (e) {
      setErro(mensagemDeErro(e));
      await atualizarEstado(leitura);
      setFase("lido");
    } finally {
      setPasso(null);
    }
  }

  /** Relê no servidor onde a importação parou (após falha), para oferecer "Retomar". */
  async function atualizarEstado(l: Leitura) {
    try {
      const { fonte, uf, desonerado } = l.escolha;
      const estado = await chamarRota<EstadoImportacao>({ acao: "estado", fonte, uf, desonerado, mesAno: l.base.mesAno, hash: l.hash });
      setLeitura({ ...l, estado });
      setGravados(estado.loteAtual);
    } catch {
      // sem conexão: mantém o estado anterior; o erro original já está na tela
    }
  }

  async function cancelar() {
    if (!leitura?.estado.importacaoId || !window.confirm("Cancelar e descartar os dados já gravados desta importação?")) return;
    try {
      await chamarRota({ acao: "cancelar", importacaoId: leitura.estado.importacaoId });
      setLeitura({ ...leitura, estado: { ...leitura.estado, situacao: "nova", importacaoId: null, loteAtual: 0 } });
      setGravados(0);
      router.refresh();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const progressoGravacao = (): ItemProgresso[] => {
    if (!leitura) return [];
    const porEtapa = contarLotesPorEtapa(leitura.lotes);
    const itens: ItemProgresso[] = [{ rotulo: "Arquivo original (Storage)", feitos: passo === "arquivos" ? 0 : 1, total: 1, ativo: passo === "arquivos" }];
    for (const etapa of ["insumos", "equipamentos", "composicoes", "itens"] as const) {
      if (!porEtapa[etapa]) continue;
      const doEtapa = leitura.lotes.filter((l) => l.etapa === etapa);
      const feitos = doEtapa.filter((l) => l.indice < gravados).length;
      const ativo = passo === "lotes" && leitura.lotes[gravados]?.etapa === etapa;
      itens.push({ rotulo: ROTULO_LOTE[etapa], feitos, total: doEtapa.length, ativo });
    }
    itens.push({ rotulo: "Encargos e validação", feitos: fase === "concluida" ? 1 : 0, total: 1, ativo: passo === "finalizar" });
    return itens;
  };

  const ocupado = fase === "lendo" || fase === "gravando";
  const situacao = leitura?.estado.situacao;

  return (
    <Card>
      <CardHeader titulo="Importar base oficial" descricao="A planilha é lida no seu navegador; o servidor recebe os dados em lotes de até 1000 linhas." />
      <CardBody className="flex flex-col gap-5">
        <form onSubmit={ler} className="grid gap-4 md:grid-cols-4">
          <Campo rotulo="Fonte" htmlFor="fonte">
            <Select id="fonte" name="fonte" defaultValue="SINAPI" disabled={ocupado}>
              <option value="SINAPI">SINAPI (Caixa)</option>
              <option value="SICRO">SICRO (DNIT)</option>
            </Select>
          </Campo>
          <Campo rotulo="UF" htmlFor="uf">
            <Select id="uf" name="uf" defaultValue="PI" disabled={ocupado}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Campo>
          <Campo rotulo="Desoneração" htmlFor="desonerado" className="justify-end">
            <Checkbox id="desonerado" name="desonerado" label="Desonerado" disabled={ocupado} />
          </Campo>
          <Campo rotulo="Arquivos (.xlsx ou .zip)" htmlFor="arquivos" ajuda="SICRO: selecione todos os relatórios da UF.">
            <Input id="arquivos" name="arquivos" type="file" accept=".xlsx,.zip" multiple disabled={ocupado} className="h-auto py-1" />
          </Campo>
          <div className="md:col-span-4">
            <Button type="submit" disabled={ocupado}>{fase === "lendo" ? "Lendo…" : "Ler e validar"}</Button>
          </div>
        </form>

        {erro ? <Alerta tom="perigo" titulo="Não foi possível concluir">{erro}</Alerta> : null}
        <CabecalhosEncontrados cabecalhos={cabecalhos} />

        {fase === "lendo" ? (
          <ol className="flex flex-col gap-1 text-sm" aria-live="polite">
            {etapasLidas.map((e, i) => (
              <li key={e} className={i === etapasLidas.length - 1 ? "font-medium text-tinta" : "text-suave"}>
                {i === etapasLidas.length - 1 ? "▸ " : "✓ "}{ROTULO_ETAPA_LEITURA[e]}
              </li>
            ))}
          </ol>
        ) : null}

        {leitura ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm">
              <p className="font-medium text-tinta">
                {leitura.base.fonte} {leitura.base.uf} {mesAno(leitura.base.mesAno)} · {leitura.base.desonerado ? "desonerado" : "não desonerado"}
                <span className="ml-2 font-mono text-xs text-suave">layout {leitura.base.layout}</span>
              </p>
              <p className="text-suave">
                {numero(leitura.base.insumos.length, 0)} insumos · {numero(leitura.base.equipamentos.length, 0)} equipamentos ·{" "}
                {numero(leitura.base.composicoes.length, 0)} composições · {numero(leitura.base.itens.length, 0)} itens ·{" "}
                {leitura.lotes.length} lotes · SHA-256 <span className="font-mono text-xs">{leitura.hash.slice(0, 16)}…</span>
              </p>
            </div>
            <ListaAvisos avisos={leitura.base.avisos} />
            <RelatorioValidacao v={leitura.validacao} />

            {situacao === "concluida" || fase === "concluida" ? (
              <Alerta tom="sucesso" titulo="Base importada">Este arquivo já está gravado para esta base e disponível para os orçamentos.</Alerta>
            ) : situacao === "conflito" ? (
              <Alerta tom="aviso" titulo="Base já existe">Esta base já foi importada de outro arquivo. Exclua-a na lista abaixo para importar de novo.</Alerta>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={gravar} disabled={ocupado}>
                  {situacao === "em_andamento" ? `Retomar (lote ${gravados + 1} de ${leitura.lotes.length})` : "Gravar no banco"}
                </Button>
                {fase === "gravando" ? (
                  <Button variant="secundario" onClick={() => { interromper.current = true; }}>Interromper</Button>
                ) : situacao === "em_andamento" && leitura.estado.importacaoId ? (
                  <Button variant="perigo" onClick={cancelar}>Cancelar importação</Button>
                ) : null}
              </div>
            )}
            {fase === "gravando" || (situacao === "em_andamento" && gravados > 0) ? <BarrasProgresso itens={progressoGravacao()} /> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
