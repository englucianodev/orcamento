import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_BASES = "bases-oficiais";

interface LinhaBase {
  id: string;
  arquivo_hash: string | null;
  arquivo_path: string | null;
}

/** Caminhos do Storage gravados para a base: `<pasta>/<sha256>-<arquivo>` (um ou vários arquivos). */
async function objetosDaBase(admin: SupabaseClient, base: LinhaBase): Promise<string[]> {
  if (!base.arquivo_path || !base.arquivo_hash) return [];
  const barra = base.arquivo_path.lastIndexOf("/");
  if (barra <= 0) return [];
  const pasta = base.arquivo_path.slice(0, barra);
  const prefixo = `${base.arquivo_hash.split(":")[0]}-`;
  const { data, error } = await admin.storage.from(BUCKET_BASES).list(pasta, { limit: 1000, search: prefixo });
  if (error) throw new Error("Não foi possível listar os arquivos guardados da base.");
  return (data ?? []).filter((o) => o.name.startsWith(prefixo)).map((o) => `${pasta}/${o.name}`);
}

/**
 * Exclui a base (cascata: insumos, composições, itens, encargos, importações) e os arquivos
 * originais no Storage — exceto quando outra base usa os mesmos arquivos (o SINAPI traz
 * desonerado e não desonerado no mesmo arquivo). Use SOMENTE com o cliente da service role,
 * depois de confirmar que o usuário é administrador da plataforma.
 * Retorna um aviso quando os arquivos não puderam ser removidos.
 */
export async function excluirBaseCompleta(
  admin: SupabaseClient, baseId: string, opcoes: { manterArquivos?: boolean } = {},
): Promise<{ aviso: string | null }> {
  const { data, error } = await admin.from("bases_referencia")
    .select("id, arquivo_hash, arquivo_path").eq("id", baseId).maybeSingle();
  if (error) throw new Error("Falha ao localizar a base.");
  if (!data) return { aviso: null };
  const base = data as LinhaBase;

  let compartilhado = false;
  if (base.arquivo_path) {
    const { count, error: e2 } = await admin.from("bases_referencia")
      .select("id", { count: "exact", head: true }).eq("arquivo_path", base.arquivo_path).neq("id", base.id);
    if (e2) throw new Error("Falha ao verificar arquivos compartilhados.");
    compartilhado = (count ?? 0) > 0;
  }

  const { error: e3 } = await admin.from("bases_referencia").delete().eq("id", base.id);
  if (e3) throw new Error("Não foi possível excluir a base. Tente novamente.");

  if (compartilhado || opcoes.manterArquivos) return { aviso: null };
  try {
    const caminhos = await objetosDaBase(admin, base);
    if (caminhos.length) {
      const { error: e4 } = await admin.storage.from(BUCKET_BASES).remove(caminhos);
      if (e4) throw new Error(e4.message);
    }
    return { aviso: null };
  } catch (erro) {
    console.error("Falha ao remover arquivos da base", base.id, erro);
    return { aviso: "A base foi excluída, mas os arquivos originais não puderam ser removidos do Storage." };
  }
}
