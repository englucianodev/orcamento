/**
 * Banco Postgres em memória (PGlite) com as migrations e o seed reais do projeto, sobre um "shim"
 * mínimo do que o Supabase fornece (papéis anon/authenticated/service_role, auth.uid/jwt, storage).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const RAIZ = resolve(import.meta.dirname, "../..");

const SHIM_SUPABASE = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt() ->> 'sub')::uuid $$;

create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
`;

export async function criarBanco(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pg_trgm, unaccent } });
  await db.exec(SHIM_SUPABASE);
  const pasta = join(RAIZ, "supabase/migrations");
  for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(pasta, arquivo), "utf8"));
  }
  await aplicarSeed(db);
  return db;
}

export async function aplicarSeed(db: PGlite): Promise<void> {
  await db.exec(readFileSync(join(RAIZ, "supabase/seed.sql"), "utf8"));
}

/** Executa como um papel do Supabase (com o JWT informado) e volta para o superusuário. */
export async function como<T>(
  db: PGlite,
  papel: "anon" | "authenticated" | "service_role",
  claims: Record<string, string> | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims ? JSON.stringify(claims) : ""]);
  await db.exec(`set role ${papel}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}

export async function criarUsuario(db: PGlite, email: string, confirmado = true): Promise<{ sub: string; email: string }> {
  const r = await db.query<{ id: string }>(
    "insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), $1, case when $2 then now() end) returning id",
    [email, confirmado],
  );
  return { sub: r.rows[0]!.id, email };
}
