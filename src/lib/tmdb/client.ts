import { env } from "@/env";

export const REGION = "BR";
export const LANGUAGE = "pt-BR";
export const TMDB_BASE = "https://api.themoviedb.org/3";

export class TmdbError extends Error {
  constructor(public status: number, public endpoint: string) {
    super(`TMDB ${status} em ${endpoint}`);
    this.name = "TmdbError";
  }
}

type Opts = { params?: Record<string, string | number | undefined>; revalidate: number };

const retryable = (s: number) => s === 429 || s >= 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function tmdbFetch<T>(path: string, { params = {}, revalidate }: Opts): Promise<T> {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("language", LANGUAGE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const init = {
    headers: { Authorization: `Bearer ${env.TMDB_READ_TOKEN}`, Accept: "application/json" },
    next: { revalidate },
  } as RequestInit;

  let res = await fetch(url, init);
  if (retryable(res.status)) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    const delaySeconds = Number.isNaN(retryAfter) ? 1 : Math.min(Math.max(retryAfter, 0), 2);
    await sleep(delaySeconds * 1000);
    res = await fetch(url, init);
  }
  if (!res.ok) throw new TmdbError(res.status, path);
  return (await res.json()) as T;
}
