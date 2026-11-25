import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabela, Td, Th } from "@/components/ui/table";
import { contextoEmpresa, type Papel } from "@/lib/empresa";
import { alterarPapel, removerConvite, removerMembro } from "../acoes-empresa";
import { FormularioConvite, FormularioNovaEmpresa } from "../formularios-empresa";

export const metadata: Metadata = { title: "Empresa" };

const ROTULO: Record<Papel, string> = { admin: "Administrador", orcamentista: "Orçamentista", leitor: "Leitor" };

interface Membro { user_id: string; email: string; nome: string | null; papel: Papel }
interface Convite { id: string; email: string; papel: Papel; criado_em: string; aceito_em: string | null }

const ERROS: Record<string, string> = {
  "ultimo-admin": "A empresa precisa de pelo menos um administrador: promova outro membro antes.",
  membro: "Não foi possível alterar o membro (só administradores alteram papéis e removem membros).",
};

export default async function PaginaEmpresa({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const ctx = await contextoEmpresa();
  if (!ctx.atual) {
    return (
      <Card>
        <CardHeader titulo="Cadastre sua empresa" descricao="Os orçamentos, configurações e o mapeamento pertencem à empresa. Você será o administrador." />
        <CardBody><FormularioNovaEmpresa /></CardBody>
      </Card>
    );
  }
  const empresa = ctx.atual;
  const admin = empresa.papel === "admin";
  const [{ data: membros }, { data: convites }] = await Promise.all([
    ctx.supabase.rpc("membros_da_empresa", { p_empresa: empresa.id }),
    admin
      ? ctx.supabase.from("convites").select("id, email, papel, criado_em, aceito_em").eq("empresa_id", empresa.id).order("criado_em", { ascending: false })
      : Promise.resolve({ data: [] as Convite[] }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {erro && ERROS[erro] ? <p role="alert" className="rounded border border-perigo/40 bg-perigo/5 px-3 py-2 text-sm text-perigo">{ERROS[erro]}</p> : null}
      <Card>
        <CardHeader titulo={empresa.nome} descricao={`Seu papel: ${ROTULO[empresa.papel]}`} />
        <CardBody>
          <Tabela>
            <thead><tr><Th>Membro</Th><Th>Papel</Th>{admin ? <Th className="w-1">Ações</Th> : null}</tr></thead>
            <tbody>
              {((membros ?? []) as Membro[]).map((m) => (
                <tr key={m.user_id}>
                  <Td>{m.nome ? <>{m.nome} <span className="text-suave">· {m.email}</span></> : m.email}</Td>
                  <Td>
                    {admin && m.user_id !== ctx.usuario.id ? (
                      <form action={alterarPapel} className="flex gap-2">
                        <input type="hidden" name="empresa" value={empresa.id} />
                        <input type="hidden" name="usuario" value={m.user_id} />
                        <select name="papel" defaultValue={m.papel} aria-label={`Papel de ${m.email}`} className="h-8 rounded border border-borda bg-superficie px-2 text-sm">
                          {Object.entries(ROTULO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>
                        <Button type="submit" size="sm" variant="secundario">Salvar</Button>
                      </form>
                    ) : <Badge>{ROTULO[m.papel]}</Badge>}
                  </Td>
                  {admin ? (
                    <Td>
                      {m.user_id !== ctx.usuario.id ? (
                        <form action={removerMembro}>
                          <input type="hidden" name="empresa" value={empresa.id} />
                          <input type="hidden" name="usuario" value={m.user_id} />
                          <Button type="submit" size="sm" variant="fantasma">Remover</Button>
                        </form>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Tabela>
        </CardBody>
      </Card>

      {admin ? (
        <Card>
          <CardHeader titulo="Convites" descricao="O link de convite só funciona para o e-mail convidado, depois de entrar ou criar a conta." />
          <CardBody className="flex flex-col gap-4">
            <FormularioConvite empresaId={empresa.id} />
            {((convites ?? []) as Convite[]).length ? (
              <Tabela>
                <thead><tr><Th>E-mail</Th><Th>Papel</Th><Th>Situação</Th><Th className="w-1" /></tr></thead>
                <tbody>
                  {((convites ?? []) as Convite[]).map((c) => (
                    <tr key={c.id}>
                      <Td>{c.email}</Td>
                      <Td>{ROTULO[c.papel]}</Td>
                      <Td>{c.aceito_em ? <Badge tom="sucesso">Aceito</Badge> : <Badge tom="aviso">Pendente</Badge>}</Td>
                      <Td>
                        <form action={removerConvite}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" size="sm" variant="fantasma">Excluir</Button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader titulo="Nova empresa" descricao="Você pode participar de mais de uma empresa e alternar no topo da página." />
        <CardBody><FormularioNovaEmpresa /></CardBody>
      </Card>
    </div>
  );
}
