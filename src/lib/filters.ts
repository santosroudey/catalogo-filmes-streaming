import { z } from "zod";

export type CatalogFilters = { providers: number[]; genre?: number; year?: number; minRating?: number; page: number };
export type SearchParams = Record<string, string | string[] | undefined>;

const MAX_PAGE = 500;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const posInt = z.coerce.number().int().positive();

function pick<T>(schema: z.ZodType<T>, raw: string | undefined): T | undefined {
  if (raw === undefined || raw === "") return undefined;
  const r = schema.safeParse(raw);
  return r.success ? r.data : undefined;
}

export function parseFilters(sp: SearchParams): CatalogFilters {
  const providers = (first(sp.servicos) ?? "")
    .split(",")
    .map((s) => pick(posInt, s.trim()))
    .filter((n): n is number => n !== undefined);

  const pageRaw = Number(first(sp.pagina));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, MAX_PAGE) : 1;

  const f: CatalogFilters = { providers, page };
  const genre = pick(posInt, first(sp.genero));
  const year = pick(posInt.min(1888).max(2100), first(sp.ano));
  const minRating = pick(z.coerce.number().min(0).max(10), first(sp.nota));
  if (genre !== undefined) f.genre = genre;
  if (year !== undefined) f.year = year;
  if (minRating !== undefined) f.minRating = minRating;
  return f;
}

export function filtersToQuery(f: CatalogFilters): string {
  const q = new URLSearchParams();
  if (f.providers.length) q.set("servicos", f.providers.join(","));
  if (f.genre !== undefined) q.set("genero", String(f.genre));
  if (f.year !== undefined) q.set("ano", String(f.year));
  if (f.minRating !== undefined) q.set("nota", String(f.minRating));
  if (f.page > 1) q.set("pagina", String(f.page));
  return q.toString();
}

export function hasProviderParam(sp: SearchParams): boolean {
  return sp.servicos !== undefined;
}
