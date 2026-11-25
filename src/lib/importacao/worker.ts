/**
 * Web Worker (módulo) que lê as planilhas oficiais sem travar a tela:
 * SHA-256 dos arquivos originais → leitura (parser por layout) → validação por recálculo.
 * Uso: new Worker(new URL("…/lib/importacao/worker.ts", import.meta.url), { type: "module" })
 */
import { lerArquivosOficiais, type ArquivoLido } from "./parsers/index";
import { LayoutDesconhecidoError } from "./parsers/tipos";
import { ehEtapaLeitura, type EtapaLeitura, type MensagemDoWorker, type PedidoLeitura } from "./protocolo";
import { validarRecalculo } from "./validacao";
import { abrirXlsx, extrairXlsxDeZip } from "./xlsx-leitor";

const escopo = self as unknown as DedicatedWorkerGlobalScope;

function enviar(msg: MensagemDoWorker): void {
  escopo.postMessage(msg);
}

const progresso = (etapa: EtapaLeitura) => enviar({ tipo: "progresso", etapa });

interface Original {
  nome: string;
  dados: Uint8Array;
}

/** Um hash por envio: com vários arquivos, concatena os bytes na ordem dos nomes. */
async function sha256(originais: readonly Original[]): Promise<string> {
  const ordenados = [...originais].sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
  const total = ordenados.reduce((n, o) => n + o.dados.byteLength, 0);
  const junto = new Uint8Array(total);
  let pos = 0;
  for (const o of ordenados) {
    junto.set(o.dados, pos);
    pos += o.dados.byteLength;
  }
  const digest = await crypto.subtle.digest("SHA-256", junto);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function planilhasDe(originais: readonly Original[]): Promise<ArquivoLido[]> {
  const saida: ArquivoLido[] = [];
  for (const o of originais) {
    if (/\.zip$/i.test(o.nome)) {
      for (const x of await extrairXlsxDeZip(o.dados)) saida.push({ nome: x.nome, livro: await abrirXlsx(x.dados) });
    } else if (/\.xlsx$/i.test(o.nome)) {
      saida.push({ nome: o.nome, livro: await abrirXlsx(o.dados) });
    } else {
      throw new Error(`Formato não suportado: ${o.nome}. Envie .xlsx ou .zip.`);
    }
  }
  return saida;
}

async function processar(pedido: PedidoLeitura): Promise<void> {
  if (pedido.arquivos.length === 0) throw new Error("Selecione ao menos um arquivo.");
  progresso("arquivos");
  const originais: Original[] = [];
  for (const f of pedido.arquivos) originais.push({ nome: f.name, dados: new Uint8Array(await f.arrayBuffer()) });
  progresso("hash");
  const hash = await sha256(originais);
  progresso("planilhas");
  const planilhas = await planilhasDe(originais);
  const base = await lerArquivosOficiais(planilhas, {
    fonte: pedido.fonte, uf: pedido.uf, desonerado: pedido.desonerado,
    aoProgredir: (etapa) => {
      if (ehEtapaLeitura(etapa)) progresso(etapa);
    },
  });
  progresso("validacao");
  const validacao = validarRecalculo(base);
  enviar({ tipo: "concluido", hash, base, validacao });
}

escopo.onmessage = (evento: MessageEvent<PedidoLeitura>) => {
  const pedido = evento.data;
  if (!pedido || pedido.tipo !== "ler") {
    enviar({ tipo: "erro", mensagem: "Pedido inválido para o leitor de planilhas." });
    return;
  }
  processar(pedido).catch((erro: unknown) => {
    if (erro instanceof LayoutDesconhecidoError) {
      enviar({ tipo: "erro", mensagem: erro.message, cabecalhos: erro.cabecalhosEncontrados });
      return;
    }
    const mensagem = erro instanceof Error ? erro.message : "Falha ao ler as planilhas.";
    enviar({ tipo: "erro", mensagem });
  });
};
