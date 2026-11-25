-- Copia o mapeamento específico de um padrão para outro, da mesma empresa, numa única instrução
-- (atômica): linhas existentes no destino com a mesma chave+fonte são atualizadas, nada é apagado antes.
create or replace function public.copiar_mapeamento_padrao(p_empresa uuid, p_origem text, p_destino text)
returns int
language plpgsql security invoker set search_path = '' as $$
declare v_qtd int;
begin
  if not public.pode_editar(p_empresa) then
    raise exception 'Sem permissão para alterar o mapeamento desta empresa.' using errcode = '42501';
  end if;
  if p_origem not in ('baixo', 'normal', 'alto', 'luxo') or p_destino not in ('baixo', 'normal', 'alto', 'luxo') then
    raise exception 'Padrão inválido.' using errcode = '22023';
  end if;
  if p_origem = p_destino then
    raise exception 'Origem e destino são o mesmo padrão.' using errcode = '22023';
  end if;
  insert into public.servicos_mapeamento (empresa_id, chave, padrao, fonte, codigo, fator_conversao)
  select m.empresa_id, m.chave, p_destino, m.fonte, m.codigo, m.fator_conversao
    from public.servicos_mapeamento m
   where m.empresa_id = p_empresa and m.padrao = p_origem
  on conflict (empresa_id, chave, padrao, fonte)
  do update set codigo = excluded.codigo, fator_conversao = excluded.fator_conversao;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

revoke execute on function public.copiar_mapeamento_padrao(uuid, text, text) from public, anon;
grant execute on function public.copiar_mapeamento_padrao(uuid, text, text) to authenticated;
