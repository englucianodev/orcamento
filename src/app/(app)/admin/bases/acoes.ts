"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contextoEmpresa } from "@/lib/empresa";
import { excluirBaseCompleta } from "@/lib/importacao/excluir-base";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export interface EstadoExclusao {
  erro?: string;
  ok?: string;
}

/** Exclui uma data-base (dados em cascata + arquivo original no Storage). Só administradores da plataforma. */
export async function excluirBase(_: EstadoExclusao, form: FormData): Promise<EstadoExclusao> {
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Base inválida." };
  const ctx = await contextoEmpresa();
  if (!ctx.adminPlataforma) return { erro: "Apenas administradores da plataforma podem excluir bases." };
  try {
    const { aviso } = await excluirBaseCompleta(criarClienteAdmin(), id.data);
    revalidatePath("/admin/bases");
    revalidatePath("/bases");
    return aviso ? { erro: aviso } : { ok: "Base excluída." };
  } catch (erro) {
    console.error("Falha ao excluir base", id.data, erro instanceof Error ? erro.message : erro);
    return { erro: "Não foi possível excluir a base. Tente novamente." };
  }
}
