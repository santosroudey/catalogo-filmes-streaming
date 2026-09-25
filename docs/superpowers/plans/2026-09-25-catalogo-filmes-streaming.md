# Catálogo de Filmes em Streaming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app público que lista filmes disponíveis agora em streaming por assinatura no Brasil (TMDB), com filtros, busca, detalhes e contas de usuário (favoritos, quero assistir, meus serviços).

**Architecture:** Next.js App Router com Server Components consultando o TMDB ao vivo, com cache via `fetch` + `revalidate`. Todo acesso ao TMDB passa por `lib/tmdb/` e devolve tipos de domínio. Postgres (Prisma) guarda apenas dados do usuário; Auth.js cuida do login.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Zod, Auth.js v5 (`next-auth@beta`) + `@auth/prisma-adapter`, Prisma + Postgres (Neon), Vitest + MSW, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-catalogo-filmes-streaming-design.md`

## Global Constraints

- Região fixa `BR` e idioma `pt-BR`, definidos como constantes apenas em `lib/tmdb/client.ts`.
- Somente monetização `flatrate` (assinatura).
- Token do TMDB (`TMDB_READ_TOKEN`) só no servidor; nunca em código de cliente nem em variável `NEXT_PUBLIC_*`.
- Somente `lib/tmdb/*` conhece URLs e JSON do TMDB; o resto consome `Movie`, `MovieDetails`, `Provider`, `Genre`.
- Atribuição obrigatória: logo do TMDB + texto "Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB." no rodapé; "Dados de disponibilidade: JustWatch" onde houver provedores.
- Filtros na URL: `servicos` (IDs separados por vírgula), `genero`, `ano`, `nota`, `pagina`.
- Paginação máxima: 500.
- Cache (`revalidate`, segundos): gêneros/provedores 604800; discover 21600; busca 3600; detalhes 43200.
- Nenhum dado de filme armazenado no banco.
- Textos da interface em pt-BR.
- TDD: teste falhando antes do código; testes verificam comportamento.

## Review Focus

1. Filme sem pôster, sem data ou sem sinopse (comum no TMDB) → card e detalhes mostram placeholder/"Sem sinopse", sem quebrar. Teste na Task 3.
2. Busca com `q` vazio ou só espaços → não chama o TMDB, mostra "Digite um título para buscar". Teste na Task 5.
3. `pagina` fora do intervalo (0, negativo, 9999, texto) → limitada a 1..500. Teste na Task 4.
4. `/filme/abc` ou ID inexistente → página 404, não erro 500. Teste na Task 5 (`details` retorna `null`) e Task 8.
5. Clique duplo em favoritar / adicionar item já existente → idempotente, sem erro de chave única. Teste na Task 10.

---

## File Structure

```
.env.example                 variáveis necessárias
vitest.config.ts             config de testes unitários/integração
playwright.config.ts         config E2E
prisma/schema.prisma         modelos Auth.js + ListItem + UserProvider
src/env.ts                   validação Zod do ambiente
src/lib/tmdb/client.ts       tmdbFetch: token, BR/pt-BR, cache, retry, TmdbError
src/lib/tmdb/types.ts        tipos de domínio + tipos brutos do TMDB
src/lib/tmdb/mappers.ts      JSON bruto → domínio
src/lib/tmdb/catalog.ts      discover, search, details, getGenres, getProviders
src/lib/filters.ts           parse da URL ↔ CatalogFilters, serialização
src/lib/db.ts                singleton Prisma
src/lib/lists.ts             regras de listas e serviços (sobre Prisma)
src/auth.ts                  configuração Auth.js
src/app/layout.tsx           layout + header + rodapé com atribuição
src/app/page.tsx             catálogo
src/app/busca/page.tsx       busca
src/app/filme/[id]/page.tsx  detalhes
src/app/filme/[id]/not-found.tsx
src/app/minha-lista/page.tsx
src/app/conta/page.tsx       meus serviços
src/app/error.tsx            erro genérico
src/app/api/catalogo/route.ts        páginas extras para scroll infinito
src/app/api/auth/[...nextauth]/route.ts
src/app/actions.ts           Server Actions (listas e serviços)
src/components/MovieCard.tsx
src/components/MovieGrid.tsx       grade + scroll infinito (client)
src/components/Filters.tsx         formulário de filtros (client)
src/components/ListButtons.tsx     favoritar / quero assistir (client, otimista)
src/components/Attribution.tsx
tests/fixtures/*.json        respostas do TMDB
tests/msw.ts                 servidor MSW
tests/unit/*.test.ts
tests/integration/*.test.ts
e2e/*.spec.ts
```

---

### Task 1: Scaffold do projeto, testes e validação de ambiente

**Files:**
- Create: projeto Next.js na raiz, `vitest.config.ts`, `tests/setup.ts`, `src/env.ts`, `.env.example`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Produces: `parseEnv(source: Record<string, string | undefined>): Env` e `env: Env` em `src/env.ts`, onde `Env = { TMDB_READ_TOKEN: string; DATABASE_URL: string; AUTH_SECRET: string; AUTH_GOOGLE_ID: string; AUTH_GOOGLE_SECRET: string; AUTH_RESEND_KEY: string; EMAIL_FROM: string }`.

- [ ] **Step 1: Criar o app Next.js na raiz (a pasta já tem `docs/` e `.git`)**

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
Se reclamar de pasta não vazia, crie em `tmp-app`, mova o conteúdo para a raiz e apague `tmp-app`.

- [ ] **Step 2: Instalar dependências de teste e Zod**

```bash
npm i zod
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths msw jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configurar Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
```

`tests/setup.ts`:
```ts
process.env.TMDB_READ_TOKEN ??= "test-token";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/catalogo_test";
process.env.AUTH_SECRET ??= "test-secret";
process.env.AUTH_GOOGLE_ID ??= "x";
process.env.AUTH_GOOGLE_SECRET ??= "x";
process.env.AUTH_RESEND_KEY ??= "x";
process.env.EMAIL_FROM ??= "noreply@example.com";
```

Em `package.json`, scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"e2e": "playwright test"
```

- [ ] **Step 4: Escrever o teste falhando**

`tests/unit/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "@/env";

const valid = {
  TMDB_READ_TOKEN: "t", DATABASE_URL: "postgresql://x", AUTH_SECRET: "s",
  AUTH_GOOGLE_ID: "g", AUTH_GOOGLE_SECRET: "gs", AUTH_RESEND_KEY: "r", EMAIL_FROM: "a@b.com",
};

describe("parseEnv", () => {
  it("aceita ambiente completo", () => {
    expect(parseEnv(valid).TMDB_READ_TOKEN).toBe("t");
  });
  it("falha nomeando a variável ausente", () => {
    const { TMDB_READ_TOKEN, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/TMDB_READ_TOKEN/);
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- tests/unit/env.test.ts`
Expected: FAIL (módulo `@/env` não existe)

- [ ] **Step 6: Implementar**

`src/env.ts`:
```ts
import { z } from "zod";

const schema = z.object({
  TMDB_READ_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  AUTH_RESEND_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${missing}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
```

`.env.example`:
```
TMDB_READ_TOKEN=
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_RESEND_KEY=
EMAIL_FROM=
```
Garanta que `.env*` (exceto `.env.example`) está no `.gitignore`.

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- tests/unit/env.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js, Vitest e validação de ambiente"
```

---

### Task 2: Cliente TMDB (token, região, cache, retry)

**Files:**
- Create: `src/lib/tmdb/client.ts`, `tests/msw.ts`
- Test: `tests/unit/tmdb-client.test.ts`

**Interfaces:**
- Consumes: `env.TMDB_READ_TOKEN` de `@/env`.
- Produces:
  - `export const REGION = "BR"; export const LANGUAGE = "pt-BR"; export const TMDB_BASE = "https://api.themoviedb.org/3";`
  - `class TmdbError extends Error { status: number; endpoint: string }`
  - `tmdbFetch<T>(path: string, opts: { params?: Record<string, string | number | undefined>; revalidate: number }): Promise<T>` — sempre adiciona `language=pt-BR`; lança `TmdbError`.
  - `tests/msw.ts`: `export const server` (setupServer) e `export const tmdb = (path: string) => TMDB_BASE + path`.

- [ ] **Step 1: Criar servidor MSW de testes**

`tests/msw.ts`:
```ts
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { TMDB_BASE } from "@/lib/tmdb/client";

export const server = setupServer();
export const tmdb = (path: string) => TMDB_BASE + path;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 2: Escrever os testes falhando**

`tests/unit/tmdb-client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server, tmdb } from "../msw";
import { tmdbFetch, TmdbError } from "@/lib/tmdb/client";

describe("tmdbFetch", () => {
  it("envia token e language=pt-BR e omite params undefined", async () => {
    let seen: URL | undefined; let auth: string | null = null;
    server.use(http.get(tmdb("/genre/movie/list"), ({ request }) => {
      seen = new URL(request.url); auth = request.headers.get("authorization");
      return HttpResponse.json({ ok: true });
    }));
    await tmdbFetch("/genre/movie/list", { params: { a: 1, b: undefined }, revalidate: 60 });
    expect(auth).toBe("Bearer test-token");
    expect(seen!.searchParams.get("language")).toBe("pt-BR");
    expect(seen!.searchParams.get("a")).toBe("1");
    expect(seen!.searchParams.has("b")).toBe(false);
  });

  it("tenta de novo uma vez após 429 e devolve o sucesso", async () => {
    let calls = 0;
    server.use(http.get(tmdb("/x"), () => {
      calls++;
      return calls === 1
        ? new HttpResponse(null, { status: 429, headers: { "Retry-After": "0" } })
        : HttpResponse.json({ ok: 1 });
    }));
    await expect(tmdbFetch("/x", { revalidate: 60 })).resolves.toEqual({ ok: 1 });
    expect(calls).toBe(2);
  });

  it("lança TmdbError após duas falhas 5xx", async () => {
    server.use(http.get(tmdb("/x"), () =>
      new HttpResponse(null, { status: 503, headers: { "Retry-After": "0" } })));
    await expect(tmdbFetch("/x", { revalidate: 60 })).rejects.toMatchObject({ status: 503, endpoint: "/x" });
  });

  it("não repete em 404 e lança TmdbError com status 404", async () => {
    let calls = 0;
    server.use(http.get(tmdb("/x"), () => { calls++; return new HttpResponse(null, { status: 404 }); }));
    const err = await tmdbFetch("/x", { revalidate: 60 }).catch((e) => e);
    expect(err).toBeInstanceOf(TmdbError);
    expect(err.status).toBe(404);
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- tests/unit/tmdb-client.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 4: Implementar**

`src/lib/tmdb/client.ts`:
```ts
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
    await sleep((Number.isFinite(retryAfter) ? retryAfter : 1) * 1000);
    res = await fetch(url, init);
  }
  if (!res.ok) throw new TmdbError(res.status, path);
  return (await res.json()) as T;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- tests/unit/tmdb-client.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: cliente TMDB com cache e retry"
```

---

### Task 3: Tipos de domínio e mappers

**Files:**
- Create: `src/lib/tmdb/types.ts`, `src/lib/tmdb/mappers.ts`, `tests/fixtures/movie-details.json`
- Test: `tests/unit/mappers.test.ts`

**Interfaces:**
- Produces (em `types.ts`):
```ts
export type Movie = { id: number; title: string; year: number | null; rating: number; posterUrl: string | null };
export type Provider = { id: number; name: string; logoUrl: string | null };
export type Genre = { id: number; name: string };
export type CastMember = { name: string; character: string; profileUrl: string | null };
export type MovieDetails = Movie & {
  overview: string; runtime: number | null; genres: Genre[]; cast: CastMember[];
  trailerKey: string | null; backdropUrl: string | null;
  providers: Provider[]; watchLink: string | null;
};
export type Page<T> = { results: T[]; page: number; totalPages: number };
```
  e os tipos brutos `RawMovie`, `RawProvider`, `RawDetails`, `RawPage`.
- Produces (em `mappers.ts`): `imageUrl(path: string | null, size: "w342" | "w780" | "w185" | "w92"): string | null`, `toMovie(raw: RawMovie): Movie`, `toProvider(raw: RawProvider): Provider`, `toMovieDetails(raw: RawDetails): MovieDetails`, `toPage(raw: RawPage): Page<Movie>` (totalPages limitado a 500).

- [ ] **Step 1: Criar a fixture**

`tests/fixtures/movie-details.json`:
```json
{
  "id": 550, "title": "Clube da Luta", "release_date": "1999-10-15", "vote_average": 8.438,
  "poster_path": "/p.jpg", "backdrop_path": "/b.jpg", "overview": "Um homem insone...",
  "runtime": 139, "genres": [{ "id": 18, "name": "Drama" }],
  "credits": { "cast": [
    { "name": "Brad Pitt", "character": "Tyler Durden", "profile_path": "/bp.jpg" },
    { "name": "Edward Norton", "character": "Narrador", "profile_path": null }
  ] },
  "videos": { "results": [
    { "site": "YouTube", "type": "Teaser", "key": "teaser1" },
    { "site": "YouTube", "type": "Trailer", "key": "trailer1" }
  ] },
  "watch/providers": { "results": {
    "US": { "link": "https://us", "flatrate": [{ "provider_id": 1, "provider_name": "X", "logo_path": "/x.jpg" }] },
    "BR": { "link": "https://www.themoviedb.org/movie/550/watch?locale=BR",
            "flatrate": [{ "provider_id": 119, "provider_name": "Amazon Prime Video", "logo_path": "/prime.jpg" }] }
  } }
}
```

- [ ] **Step 2: Escrever os testes falhando**

`tests/unit/mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import details from "../fixtures/movie-details.json";
import { toMovie, toMovieDetails, toPage, imageUrl } from "@/lib/tmdb/mappers";

describe("mappers", () => {
  it("toMovie converte campos e arredonda nota para 1 casa", () => {
    expect(toMovie({ id: 1, title: "A", release_date: "2024-05-01", vote_average: 7.456, poster_path: "/a.jpg" }))
      .toEqual({ id: 1, title: "A", year: 2024, rating: 7.5, posterUrl: "https://image.tmdb.org/t/p/w342/a.jpg" });
  });

  it("toMovie tolera pôster e data ausentes ou vazios", () => {
    const m = toMovie({ id: 2, title: "B", release_date: "", vote_average: 0, poster_path: null });
    expect(m.year).toBeNull();
    expect(m.posterUrl).toBeNull();
  });

  it("toMovieDetails usa só BR/flatrate, primeiro trailer do YouTube e elenco", () => {
    const d = toMovieDetails(details as never);
    expect(d.providers).toEqual([{ id: 119, name: "Amazon Prime Video", logoUrl: "https://image.tmdb.org/t/p/w92/prime.jpg" }]);
    expect(d.watchLink).toContain("locale=BR");
    expect(d.trailerKey).toBe("trailer1");
    expect(d.cast[1]).toEqual({ name: "Edward Norton", character: "Narrador", profileUrl: null });
  });

  it("toMovieDetails sem BR, sem vídeos e sem sinopse", () => {
    const d = toMovieDetails({ ...(details as never), overview: "", videos: { results: [] }, "watch/providers": { results: {} } });
    expect(d.providers).toEqual([]);
    expect(d.watchLink).toBeNull();
    expect(d.trailerKey).toBeNull();
    expect(d.overview).toBe("Sem sinopse disponível.");
  });

  it("toPage limita totalPages a 500", () => {
    expect(toPage({ page: 1, total_pages: 9000, results: [] }).totalPages).toBe(500);
  });

  it("imageUrl retorna null para caminho nulo", () => {
    expect(imageUrl(null, "w342")).toBeNull();
  });
});
```

Em `tsconfig.json`, confirme `"resolveJsonModule": true`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- tests/unit/mappers.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 4: Implementar os tipos**

`src/lib/tmdb/types.ts`:
```ts
export type Movie = { id: number; title: string; year: number | null; rating: number; posterUrl: string | null };
export type Provider = { id: number; name: string; logoUrl: string | null };
export type Genre = { id: number; name: string };
export type CastMember = { name: string; character: string; profileUrl: string | null };
export type MovieDetails = Movie & {
  overview: string; runtime: number | null; genres: Genre[]; cast: CastMember[];
  trailerKey: string | null; backdropUrl: string | null;
  providers: Provider[]; watchLink: string | null;
};
export type Page<T> = { results: T[]; page: number; totalPages: number };

// Formato bruto do TMDB (usado apenas dentro de lib/tmdb)
export type RawMovie = {
  id: number; title: string; release_date?: string; vote_average: number; poster_path: string | null;
};
export type RawProvider = { provider_id: number; provider_name: string; logo_path: string | null };
export type RawPage = { page: number; total_pages: number; results: RawMovie[] };
export type RawDetails = RawMovie & {
  backdrop_path: string | null; overview: string; runtime: number | null; genres: Genre[];
  credits: { cast: { name: string; character: string; profile_path: string | null }[] };
  videos: { results: { site: string; type: string; key: string }[] };
  "watch/providers": { results: Record<string, { link?: string; flatrate?: RawProvider[] }> };
};
```

- [ ] **Step 5: Implementar os mappers**

`src/lib/tmdb/mappers.ts`:
```ts
import { REGION } from "./client";
import type { Movie, MovieDetails, Page, Provider, RawDetails, RawMovie, RawPage, RawProvider } from "./types";

const MAX_PAGES = 500;

export function imageUrl(path: string | null, size: "w342" | "w780" | "w185" | "w92"): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function toMovie(raw: RawMovie): Movie {
  const year = raw.release_date ? Number(raw.release_date.slice(0, 4)) : NaN;
  return {
    id: raw.id,
    title: raw.title,
    year: Number.isFinite(year) ? year : null,
    rating: Math.round(raw.vote_average * 10) / 10,
    posterUrl: imageUrl(raw.poster_path, "w342"),
  };
}

export function toProvider(raw: RawProvider): Provider {
  return { id: raw.provider_id, name: raw.provider_name, logoUrl: imageUrl(raw.logo_path, "w92") };
}

export function toPage(raw: RawPage): Page<Movie> {
  return { page: raw.page, totalPages: Math.min(raw.total_pages, MAX_PAGES), results: raw.results.map(toMovie) };
}

export function toMovieDetails(raw: RawDetails): MovieDetails {
  const br = raw["watch/providers"]?.results?.[REGION];
  const trailer = raw.videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
  return {
    ...toMovie(raw),
    overview: raw.overview?.trim() || "Sem sinopse disponível.",
    runtime: raw.runtime ?? null,
    genres: raw.genres,
    backdropUrl: imageUrl(raw.backdrop_path, "w780"),
    cast: raw.credits.cast.slice(0, 12).map((c) => ({
      name: c.name, character: c.character, profileUrl: imageUrl(c.profile_path, "w185"),
    })),
    trailerKey: trailer?.key ?? null,
    providers: (br?.flatrate ?? []).map(toProvider),
    watchLink: br?.link ?? null,
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- tests/unit/mappers.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: tipos de domínio e mappers do TMDB"
```

---

### Task 4: Filtros da URL

**Files:**
- Create: `src/lib/filters.ts`
- Test: `tests/unit/filters.test.ts`

**Interfaces:**
- Produces:
```ts
export type CatalogFilters = { providers: number[]; genre?: number; year?: number; minRating?: number; page: number };
export type SearchParams = Record<string, string | string[] | undefined>;
export function parseFilters(sp: SearchParams): CatalogFilters;
export function filtersToQuery(f: CatalogFilters): string; // sem "?"; omite vazios e page=1
export function hasProviderParam(sp: SearchParams): boolean;
```

- [ ] **Step 1: Escrever os testes falhando**

`tests/unit/filters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseFilters, filtersToQuery, hasProviderParam } from "@/lib/filters";

describe("parseFilters", () => {
  it("lê todos os filtros válidos", () => {
    expect(parseFilters({ servicos: "8,119", genero: "28", ano: "2024", nota: "7", pagina: "3" }))
      .toEqual({ providers: [8, 119], genre: 28, year: 2024, minRating: 7, page: 3 });
  });

  it("descarta individualmente valores inválidos", () => {
    expect(parseFilters({ servicos: "8,abc,,-1", genero: "x", ano: "1700", nota: "11" }))
      .toEqual({ providers: [8], page: 1 });
  });

  it.each([["0", 1], ["-5", 1], ["9999", 500], ["abc", 1], [undefined, 1]])(
    "pagina=%s vira %s", (pagina, expected) => {
      expect(parseFilters({ pagina }).page).toBe(expected);
    });

  it("usa o primeiro valor quando o parâmetro se repete", () => {
    expect(parseFilters({ genero: ["12", "28"] }).genre).toBe(12);
  });
});

describe("filtersToQuery", () => {
  it("serializa omitindo vazios e página 1", () => {
    expect(filtersToQuery({ providers: [8, 119], genre: 28, page: 1 })).toBe("servicos=8%2C119&genero=28");
  });
  it("faz ida e volta com parseFilters", () => {
    const f = { providers: [337], year: 2020, minRating: 6, page: 4 };
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
  });
});

describe("hasProviderParam", () => {
  it("detecta presença do parâmetro servicos", () => {
    expect(hasProviderParam({ servicos: "" })).toBe(true);
    expect(hasProviderParam({})).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/unit/filters.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

`src/lib/filters.ts`:
```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/unit/filters.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: parse e serialização dos filtros da URL"
```

---

### Task 5: Funções do catálogo (discover, busca, detalhes, gêneros, provedores)

**Files:**
- Create: `src/lib/tmdb/catalog.ts`
- Test: `tests/unit/catalog.test.ts`

**Interfaces:**
- Consumes: `tmdbFetch`, `REGION`, `TmdbError` (Task 2); mappers e tipos (Task 3); `CatalogFilters` (Task 4).
- Produces:
```ts
export function discover(f: CatalogFilters): Promise<Page<Movie>>;
export function search(query: string, page?: number): Promise<Page<Movie>>; // query vazia → página vazia sem chamar TMDB
export function details(id: number): Promise<MovieDetails | null>;           // 404 → null
export function getGenres(): Promise<Genre[]>;
export function getProviders(): Promise<Provider[]>;                         // provedores BR, ordenados por prioridade de exibição
```

- [ ] **Step 1: Escrever os testes falhando**

`tests/unit/catalog.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server, tmdb } from "../msw";
import details from "../fixtures/movie-details.json";
import { discover, search, details as getDetails, getProviders } from "@/lib/tmdb/catalog";

const emptyPage = { page: 1, total_pages: 1, results: [] };

describe("catalog", () => {
  it("discover monta a query com região, flatrate e filtros", async () => {
    let q: URLSearchParams | undefined;
    server.use(http.get(tmdb("/discover/movie"), ({ request }) => {
      q = new URL(request.url).searchParams; return HttpResponse.json(emptyPage);
    }));
    await discover({ providers: [8, 119], genre: 28, year: 2024, minRating: 7, page: 2 });
    expect(Object.fromEntries(q!)).toMatchObject({
      watch_region: "BR", with_watch_monetization_types: "flatrate",
      with_watch_providers: "8|119", with_genres: "28", primary_release_year: "2024",
      "vote_average.gte": "7", sort_by: "popularity.desc", page: "2",
    });
  });

  it("discover sem serviços não envia with_watch_providers", async () => {
    let q: URLSearchParams | undefined;
    server.use(http.get(tmdb("/discover/movie"), ({ request }) => {
      q = new URL(request.url).searchParams; return HttpResponse.json(emptyPage);
    }));
    await discover({ providers: [], page: 1 });
    expect(q!.has("with_watch_providers")).toBe(false);
    expect(q!.get("with_watch_monetization_types")).toBe("flatrate");
  });

  it("search com query vazia ou só espaços não chama o TMDB", async () => {
    // onUnhandledRequest: "error" faria o teste falhar se houvesse chamada
    expect(await search("   ")).toEqual({ results: [], page: 1, totalPages: 0 });
  });

  it("search envia query aparada e region=BR", async () => {
    let q: URLSearchParams | undefined;
    server.use(http.get(tmdb("/search/movie"), ({ request }) => {
      q = new URL(request.url).searchParams; return HttpResponse.json(emptyPage);
    }));
    await search("  matrix ");
    expect(q!.get("query")).toBe("matrix");
    expect(q!.get("region")).toBe("BR");
  });

  it("details pede append_to_response e mapeia", async () => {
    let q: URLSearchParams | undefined;
    server.use(http.get(tmdb("/movie/550"), ({ request }) => {
      q = new URL(request.url).searchParams; return HttpResponse.json(details);
    }));
    const d = await getDetails(550);
    expect(q!.get("append_to_response")).toBe("credits,videos,watch/providers");
    expect(d!.title).toBe("Clube da Luta");
  });

  it("details retorna null em 404", async () => {
    server.use(http.get(tmdb("/movie/999999"), () => new HttpResponse(null, { status: 404 })));
    expect(await getDetails(999999)).toBeNull();
  });

  it("getProviders ordena por display_priority para BR", async () => {
    server.use(http.get(tmdb("/watch/providers/movie"), () => HttpResponse.json({ results: [
      { provider_id: 119, provider_name: "Prime", logo_path: null, display_priorities: { BR: 2 } },
      { provider_id: 8, provider_name: "Netflix", logo_path: null, display_priorities: { BR: 1 } },
    ] })));
    expect((await getProviders()).map((p) => p.id)).toEqual([8, 119]);
  });
});
```

O import de `../msw` em cada arquivo de teste já liga o servidor MSW.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/unit/catalog.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

`src/lib/tmdb/catalog.ts`:
```ts
import type { CatalogFilters } from "@/lib/filters";
import { REGION, TmdbError, tmdbFetch } from "./client";
import { toMovieDetails, toPage, toProvider } from "./mappers";
import type { Genre, Movie, MovieDetails, Page, Provider, RawDetails, RawPage, RawProvider } from "./types";

const DAY = 86400;
const REVALIDATE = { static: 7 * DAY, discover: 6 * 3600, search: 3600, details: 12 * 3600 };

export async function discover(f: CatalogFilters): Promise<Page<Movie>> {
  const raw = await tmdbFetch<RawPage>("/discover/movie", {
    revalidate: REVALIDATE.discover,
    params: {
      watch_region: REGION,
      with_watch_monetization_types: "flatrate",
      with_watch_providers: f.providers.length ? f.providers.join("|") : undefined,
      with_genres: f.genre,
      primary_release_year: f.year,
      "vote_average.gte": f.minRating,
      sort_by: "popularity.desc",
      page: f.page,
    },
  });
  return toPage(raw);
}

export async function search(query: string, page = 1): Promise<Page<Movie>> {
  const q = query.trim();
  if (!q) return { results: [], page: 1, totalPages: 0 };
  const raw = await tmdbFetch<RawPage>("/search/movie", {
    revalidate: REVALIDATE.search,
    params: { query: q, region: REGION, page },
  });
  return toPage(raw);
}

export async function details(id: number): Promise<MovieDetails | null> {
  try {
    const raw = await tmdbFetch<RawDetails>(`/movie/${id}`, {
      revalidate: REVALIDATE.details,
      params: { append_to_response: "credits,videos,watch/providers" },
    });
    return toMovieDetails(raw);
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) return null;
    throw e;
  }
}

export async function getGenres(): Promise<Genre[]> {
  const raw = await tmdbFetch<{ genres: Genre[] }>("/genre/movie/list", { revalidate: REVALIDATE.static });
  return raw.genres;
}

type RawListedProvider = RawProvider & { display_priorities?: Record<string, number> };

export async function getProviders(): Promise<Provider[]> {
  const raw = await tmdbFetch<{ results: RawListedProvider[] }>("/watch/providers/movie", {
    revalidate: REVALIDATE.static,
    params: { watch_region: REGION },
  });
  const prio = (p: RawListedProvider) => p.display_priorities?.[REGION] ?? Number.MAX_SAFE_INTEGER;
  return [...raw.results].sort((a, b) => prio(a) - prio(b)).map(toProvider);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos os testes até aqui)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: funções de catálogo do TMDB"
```

---

### Task 6: Layout, atribuição, página do catálogo e scroll infinito

**Files:**
- Create: `src/components/Attribution.tsx`, `src/components/MovieCard.tsx`, `src/components/MovieGrid.tsx`, `src/components/Filters.tsx`, `src/app/api/catalogo/route.ts`, `src/app/error.tsx`, `public/tmdb-logo.svg`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `next.config.ts`
- Test: `tests/unit/catalog-route.test.ts`, `tests/unit/movie-card.test.tsx`

**Interfaces:**
- Consumes: `discover`, `getGenres`, `getProviders` (Task 5); `parseFilters`, `filtersToQuery`, `CatalogFilters`, `SearchParams` (Task 4); `Movie`, `Genre`, `Provider` (Task 3).
- Produces:
  - `<MovieCard movie: Movie />` — link para `/filme/{id}`.
  - `<MovieGrid initial: Page<Movie>; query: string />` — `query` é `filtersToQuery` sem `pagina`; carrega `/api/catalogo?{query}&pagina=N`.
  - `<Filters providers: Provider[]; genres: Genre[]; value: CatalogFilters />`.
  - `GET /api/catalogo` → JSON `Page<Movie>`; em `TmdbError` responde 502 `{ error: string }`.
  - `export async function CatalogPage(props: { filters: CatalogFilters })` interno de `page.tsx` não exportado (Task 11 altera como `filters` é obtido).

- [ ] **Step 1: Escrever os testes falhando**

`tests/unit/catalog-route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server, tmdb } from "../msw";
import { GET } from "@/app/api/catalogo/route";

describe("GET /api/catalogo", () => {
  it("repassa filtros da URL ao discover e devolve Page<Movie>", async () => {
    let q: URLSearchParams | undefined;
    server.use(http.get(tmdb("/discover/movie"), ({ request }) => {
      q = new URL(request.url).searchParams;
      return HttpResponse.json({ page: 2, total_pages: 3, results: [
        { id: 1, title: "A", release_date: "2020-01-01", vote_average: 7, poster_path: null },
      ] });
    }));
    const res = await GET(new Request("http://localhost/api/catalogo?servicos=8&pagina=2"));
    const body = await res.json();
    expect(q!.get("with_watch_providers")).toBe("8");
    expect(body).toEqual({ page: 2, totalPages: 3, results: [{ id: 1, title: "A", year: 2020, rating: 7, posterUrl: null }] });
  });

  it("responde 502 quando o TMDB falha", async () => {
    server.use(http.get(tmdb("/discover/movie"), () =>
      new HttpResponse(null, { status: 500, headers: { "Retry-After": "0" } })));
    const res = await GET(new Request("http://localhost/api/catalogo"));
    expect(res.status).toBe(502);
  });
});
```

`tests/unit/movie-card.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MovieCard } from "@/components/MovieCard";

describe("MovieCard", () => {
  it("mostra placeholder quando não há pôster nem ano", () => {
    render(<MovieCard movie={{ id: 7, title: "Sem Pôster", year: null, rating: 0, posterUrl: null }} />);
    expect(screen.getByText("Sem imagem")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/filme/7");
    expect(screen.queryByText("null")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/unit/catalog-route.test.ts tests/unit/movie-card.test.tsx`
Expected: FAIL (módulos não existem)

- [ ] **Step 3: Implementar a rota**

`src/app/api/catalogo/route.ts`:
```ts
import { parseFilters } from "@/lib/filters";
import { discover } from "@/lib/tmdb/catalog";
import { TmdbError } from "@/lib/tmdb/client";

export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  try {
    return Response.json(await discover(parseFilters(sp)));
  } catch (e) {
    if (e instanceof TmdbError) return Response.json({ error: "Falha ao consultar o TMDB" }, { status: 502 });
    throw e;
  }
}
```

- [ ] **Step 4: Implementar os componentes**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }] },
};
export default nextConfig;
```

`src/components/MovieCard.tsx`:
```tsx
import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/lib/tmdb/types";

export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Link href={`/filme/${movie.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-neutral-800">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width: 640px) 50vw, 200px"
            className="object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">Sem imagem</div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium">{movie.title}</h3>
      <p className="text-xs text-neutral-400">
        {movie.year ?? "—"} · ★ {movie.rating.toFixed(1)}
      </p>
    </Link>
  );
}
```

`src/components/MovieGrid.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { Movie, Page } from "@/lib/tmdb/types";
import { MovieCard } from "./MovieCard";

export function MovieGrid({ initial, query }: { initial: Page<Movie>; query: string }) {
  const [movies, setMovies] = useState(initial.results);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = page < initial.totalPages;

  useEffect(() => { setMovies(initial.results); setPage(initial.page); setFailed(false); }, [initial]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || failed) return;
    const obs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loading) return;
      setLoading(true);
      try {
        const sep = query ? "&" : "";
        const res = await fetch(`/api/catalogo?${query}${sep}pagina=${page + 1}`);
        if (!res.ok) throw new Error();
        const next: Page<Movie> = await res.json();
        setMovies((m) => [...m, ...next.results.filter((n) => !m.some((x) => x.id === n.id))]);
        setPage(next.page);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: "600px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page, hasMore, loading, failed, query]);

  if (movies.length === 0) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {movies.map((m) => <MovieCard key={m.id} movie={m} />)}
      </div>
      <div ref={sentinel} className="h-10" />
      {loading && <p className="text-center text-neutral-400">Carregando…</p>}
      {failed && (
        <button onClick={() => setFailed(false)} className="mx-auto block rounded bg-neutral-800 px-4 py-2">
          Erro ao carregar mais. Tentar novamente
        </button>
      )}
    </>
  );
}
```

`src/components/Filters.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { filtersToQuery, type CatalogFilters } from "@/lib/filters";
import type { Genre, Provider } from "@/lib/tmdb/types";

export function Filters({ providers, genres, value }: { providers: Provider[]; genres: Genre[]; value: CatalogFilters }) {
  const router = useRouter();
  const go = (f: CatalogFilters) => {
    // "servicos=" vazio preserva a escolha explícita de "nenhum serviço" (Task 11)
    const q = filtersToQuery({ ...f, page: 1 });
    router.push(f.providers.length ? `/?${q}` : `/?servicos=${q ? "&" + q : ""}`);
  };
  const toggle = (id: number) =>
    go({ ...value, providers: value.providers.includes(id) ? value.providers.filter((p) => p !== id) : [...value.providers, id] });
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const years = Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - i);

  return (
    <section className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {providers.slice(0, 20).map((p) => (
          <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={value.providers.includes(p.id)}
            className={`rounded-full border px-3 py-1 text-sm ${value.providers.includes(p.id) ? "border-white bg-white text-black" : "border-neutral-600"}`}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <select aria-label="Gênero" value={value.genre ?? ""} onChange={(e) => go({ ...value, genre: num(e.target.value) })}
          className="rounded bg-neutral-800 px-2 py-1">
          <option value="">Todos os gêneros</option>
          {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select aria-label="Ano" value={value.year ?? ""} onChange={(e) => go({ ...value, year: num(e.target.value) })}
          className="rounded bg-neutral-800 px-2 py-1">
          <option value="">Qualquer ano</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Nota mínima" value={value.minRating ?? ""} onChange={(e) => go({ ...value, minRating: num(e.target.value) })}
          className="rounded bg-neutral-800 px-2 py-1">
          <option value="">Qualquer nota</option>
          {[5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}+</option>)}
        </select>
        <button onClick={() => router.push("/?servicos=")} className="underline">Limpar filtros</button>
      </div>
    </section>
  );
}
```

`src/components/Attribution.tsx`:
```tsx
import Image from "next/image";

export function Attribution() {
  return (
    <footer className="mt-16 border-t border-neutral-800 py-6 text-xs text-neutral-400">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4">
        <Image src="/tmdb-logo.svg" alt="TMDB" width={80} height={12} />
        <p>Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
          Dados de disponibilidade: JustWatch.</p>
      </div>
    </footer>
  );
}
```

Baixe o logo oficial em https://www.themoviedb.org/about/logos-attribution e salve como `public/tmdb-logo.svg`.

- [ ] **Step 5: Layout, página e erro**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Attribution } from "@/components/Attribution";
import "./globals.css";

export const metadata: Metadata = {
  title: "Em Cartaz no Streaming",
  description: "Filmes disponíveis agora nos serviços de streaming do Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800">
          <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-bold">Em Cartaz no Streaming</Link>
            <form action="/busca" className="ml-auto">
              <input name="q" placeholder="Buscar filme…" aria-label="Buscar filme"
                className="rounded bg-neutral-800 px-3 py-1 text-sm" />
            </form>
            {/* Task 9 adiciona aqui <UserMenu /> */}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <Attribution />
      </body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
import { Filters } from "@/components/Filters";
import { MovieGrid } from "@/components/MovieGrid";
import { filtersToQuery, parseFilters, type CatalogFilters, type SearchParams } from "@/lib/filters";
import { discover, getGenres, getProviders } from "@/lib/tmdb/catalog";

async function CatalogPage({ filters }: { filters: CatalogFilters }) {
  const [page, genres, providers] = await Promise.all([discover(filters), getGenres(), getProviders()]);
  const query = filtersToQuery({ ...filters, page: 1 });
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Disponível agora no streaming</h1>
      <Filters providers={providers} genres={genres} value={filters} />
      {page.results.length === 0 ? (
        <p className="text-neutral-400">Nenhum filme com esses filtros. <a href="/?servicos=" className="underline">Limpar filtros</a></p>
      ) : (
        <MovieGrid initial={page} query={query} />
      )}
    </>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return <CatalogPage filters={parseFilters(sp)} />;
}
```

`src/app/error.tsx`:
```tsx
"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <p className="mb-4">Não conseguimos carregar os filmes agora.</p>
      <button onClick={reset} className="rounded bg-white px-4 py-2 text-black">Tentar novamente</button>
    </div>
  );
}
```

- [ ] **Step 6: Rodar testes**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Verificação manual**

Crie `.env.local` com um token real do TMDB (obtido em https://www.themoviedb.org/settings/api) e valores de mentira para as outras variáveis. Rode `npm run dev` e abra http://localhost:3000. Confirme: grade carrega, clicar em "Netflix" muda a URL para `?servicos=8` e filtra, rolar a página carrega mais filmes, rodapé com atribuição visível.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: página de catálogo com filtros e scroll infinito"
```

---

### Task 7: Página de busca

**Files:**
- Create: `src/app/busca/page.tsx`

**Interfaces:**
- Consumes: `search` (Task 5), `MovieCard` (Task 6).

- [ ] **Step 1: Implementar a página**

(A lógica testável — query vazia sem chamar o TMDB, `region=BR` — já está coberta pelos testes da Task 5. A página só compõe; o comportamento é verificado no E2E da Task 12.)

`src/app/busca/page.tsx`:
```tsx
import { MovieCard } from "@/components/MovieCard";
import type { SearchParams } from "@/lib/filters";
import { search } from "@/lib/tmdb/catalog";

export default async function BuscaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q ?? "").trim();
  if (!q) return <p className="text-neutral-400">Digite um título para buscar.</p>;

  const page = await search(q);
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Resultados para “{q}”</h1>
      <p className="mb-6 text-sm text-neutral-400">Abra um filme para ver em quais streamings ele está disponível.</p>
      {page.results.length === 0 ? (
        <p className="text-neutral-400">Nenhum filme encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {page.results.map((m) => <MovieCard key={m.id} movie={m} />)}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificação manual**

Com `npm run dev`: buscar "matrix" no header mostra resultados; acessar `/busca?q=%20%20` mostra "Digite um título para buscar."

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: página de busca"
```

---

### Task 8: Página de detalhes do filme

**Files:**
- Create: `src/app/filme/[id]/page.tsx`, `src/app/filme/[id]/not-found.tsx`, `src/lib/ids.ts`
- Test: `tests/unit/ids.test.ts`

**Interfaces:**
- Consumes: `details` (Task 5), `MovieDetails` (Task 3).
- Produces: `parseMovieId(raw: string): number | null` em `src/lib/ids.ts`. A página contém um marcador `{/* Task 10: <ListButtons /> */}` onde os botões de lista serão inseridos.

- [ ] **Step 1: Escrever o teste falhando**

`tests/unit/ids.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseMovieId } from "@/lib/ids";

describe("parseMovieId", () => {
  it.each([["550", 550], ["550-clube-da-luta", null], ["abc", null], ["0", null], ["-3", null], ["1.5", null]])(
    "%s → %s", (raw, expected) => expect(parseMovieId(raw)).toBe(expected));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/unit/ids.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

`src/lib/ids.ts`:
```ts
export function parseMovieId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}
```

`src/app/filme/[id]/not-found.tsx`:
```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="mb-4">Filme não encontrado.</p>
      <Link href="/" className="underline">Voltar ao catálogo</Link>
    </div>
  );
}
```

`src/app/filme/[id]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { parseMovieId } from "@/lib/ids";
import { details } from "@/lib/tmdb/catalog";

type Props = { params: Promise<{ id: string }> };

async function load(params: Props["params"]) {
  const id = parseMovieId((await params).id);
  const movie = id ? await details(id) : null;
  if (!movie) notFound();
  return movie;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await load(params);
  return { title: `${movie.title} — onde assistir`, description: movie.overview.slice(0, 160) };
}

export default async function FilmePage({ params }: Props) {
  const movie = await load(params);
  return (
    <article className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="relative aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
          {movie.posterUrl
            ? <Image src={movie.posterUrl} alt={movie.title} fill sizes="192px" className="object-cover" priority />
            : <div className="flex h-full items-center justify-center text-sm text-neutral-400">Sem imagem</div>}
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">{movie.title}</h1>
          <p className="text-neutral-400">
            {[movie.year, movie.runtime ? `${movie.runtime} min` : null, movie.genres.map((g) => g.name).join(", ")]
              .filter(Boolean).join(" · ")} · ★ {movie.rating.toFixed(1)}
          </p>
          {/* Task 10: <ListButtons /> */}
          <p className="max-w-2xl">{movie.overview}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Onde assistir</h2>
        {movie.providers.length === 0 ? (
          <p className="text-neutral-400">Este filme não está em nenhum streaming no Brasil agora.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {movie.providers.map((p) => (
              <a key={p.id} href={movie.watchLink ?? "#"} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded bg-neutral-800 px-3 py-2">
                {p.logoUrl && <Image src={p.logoUrl} alt="" width={28} height={28} className="rounded" />}
                {p.name}
              </a>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-500">Dados de disponibilidade: JustWatch.</p>
      </section>

      {movie.trailerKey && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Trailer</h2>
          <div className="aspect-video max-w-3xl">
            <iframe className="h-full w-full rounded" src={`https://www.youtube-nocookie.com/embed/${movie.trailerKey}`}
              title={`Trailer de ${movie.title}`} allowFullScreen />
          </div>
        </section>
      )}

      {movie.cast.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Elenco</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {movie.cast.map((c) => (
              <li key={c.name + c.character} className="text-sm">
                <p className="font-medium">{c.name}</p>
                <p className="text-neutral-400">{c.character}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Verificação manual**

`/filme/550` mostra detalhes, provedores BR e trailer. `/filme/abc` e `/filme/999999999` mostram "Filme não encontrado." com status 404 (verifique na aba Network).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: página de detalhes do filme"
```

---

### Task 9: Banco de dados e autenticação

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/components/UserMenu.tsx`
- Modify: `src/app/layout.tsx` (inserir `<UserMenu />` no lugar do comentário da Task 9)

**Interfaces:**
- Produces:
  - `db: PrismaClient` em `src/lib/db.ts`.
  - `auth(): Promise<Session | null>`, `signIn`, `signOut`, `handlers` em `src/auth.ts`; `session.user.id: string` disponível.
  - Modelos `ListItem`, `UserProvider`, enum `ListType { FAVORITE WATCHLIST }`.

- [ ] **Step 1: Instalar e iniciar Prisma**

```bash
npm i next-auth@beta @auth/prisma-adapter @prisma/client
npm i -D prisma
npx prisma init
```

- [ ] **Step 2: Escrever o schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  name          String?
  email         String?        @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  listItems     ListItem[]
  providers     UserProvider[]
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}

enum ListType {
  FAVORITE
  WATCHLIST
}

model ListItem {
  id        String   @id @default(cuid())
  userId    String
  tmdbId    Int
  type      ListType
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, tmdbId, type])
  @@index([userId, type, createdAt])
}

model UserProvider {
  userId     String
  providerId Int
  user       User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, providerId])
}
```

- [ ] **Step 3: Criar o banco e a migration**

Crie um banco no Neon (https://neon.tech), coloque a URL em `.env.local` como `DATABASE_URL` e também em `.env` (o Prisma CLI lê `.env`). Depois:
```bash
npx prisma migrate dev --name init
```
Expected: migration criada em `prisma/migrations/` e aplicada.

- [ ] **Step 4: Cliente Prisma e Auth.js**

`src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

`src/auth.ts`:
```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
    Resend({ apiKey: env.AUTH_RESEND_KEY, from: env.EMAIL_FROM }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

`src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

`src/components/UserMenu.tsx`:
```tsx
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) {
    return (
      <form action={async () => { "use server"; await signIn(); }}>
        <button className="text-sm underline">Entrar</button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/minha-lista">Minha lista</Link>
      <Link href="/conta">Meus serviços</Link>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
        <button className="underline">Sair</button>
      </form>
    </div>
  );
}
```

Em `src/app/layout.tsx`, troque `{/* Task 9 adiciona aqui <UserMenu /> */}` por `<UserMenu />` e adicione `import { UserMenu } from "@/components/UserMenu";`.

- [ ] **Step 5: Configurar credenciais**

- Google: crie um OAuth Client em https://console.cloud.google.com/apis/credentials com redirect `http://localhost:3000/api/auth/callback/google`.
- Resend: crie uma API key em https://resend.com e um remetente verificado para `EMAIL_FROM`.
- `AUTH_SECRET`: `npx auth secret`.

- [ ] **Step 6: Verificação manual**

Run: `npm run dev` → clicar "Entrar" → login com Google → header mostra "Minha lista / Meus serviços / Sair". Em `npx prisma studio`, confirme um `User` criado. `npm test` continua passando.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: banco Prisma e autenticação Auth.js"
```

---

### Task 10: Listas do usuário (favoritos e quero assistir)

**Files:**
- Create: `src/lib/lists.ts`, `src/app/actions.ts`, `src/components/ListButtons.tsx`, `src/app/minha-lista/page.tsx`, `tests/integration/db.ts`
- Modify: `src/app/filme/[id]/page.tsx` (substituir marcador da Task 10)
- Test: `tests/integration/lists.test.ts`

**Interfaces:**
- Consumes: `db` (Task 9), `auth` (Task 9), `details` (Task 5), `MovieCard` (Task 6).
- Produces (em `src/lib/lists.ts`):
```ts
export type ListKind = "FAVORITE" | "WATCHLIST";
export function setInList(userId: string, tmdbId: number, type: ListKind, on: boolean): Promise<void>; // idempotente
export function getListIds(userId: string, type: ListKind): Promise<number[]>;                          // mais recente primeiro
export function getMembership(userId: string, tmdbId: number): Promise<{ favorite: boolean; watchlist: boolean }>;
export function getUserProviders(userId: string): Promise<number[]>;
export function setUserProviders(userId: string, providerIds: number[]): Promise<void>;                 // substitui o conjunto
```
- Produces (em `src/app/actions.ts`): `toggleList(tmdbId: number, type: ListKind, on: boolean): Promise<{ ok: true } | { ok: false; reason: "unauthenticated" }>`.

- [ ] **Step 1: Banco de teste**

Crie um banco Postgres de teste (branch separada no Neon ou Postgres local em Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=catalogo_test postgres:16`). Aplique o schema:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/catalogo_test npx prisma migrate deploy
```

`tests/integration/db.ts`:
```ts
import { beforeEach } from "vitest";
import { db } from "@/lib/db";

beforeEach(async () => {
  await db.listItem.deleteMany();
  await db.userProvider.deleteMany();
  await db.user.deleteMany();
});

export async function makeUser() {
  return db.user.create({ data: { email: `u${Date.now()}${Math.random()}@test.com` } });
}
```

Em `vitest.config.ts`, adicione `fileParallelism: false` dentro de `test` (os testes de integração compartilham o banco).

- [ ] **Step 2: Escrever os testes falhando**

`tests/integration/lists.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeUser } from "./db";
import { getListIds, getMembership, setInList, getUserProviders, setUserProviders } from "@/lib/lists";

describe("listas", () => {
  it("adiciona e remove de favoritos", async () => {
    const u = await makeUser();
    await setInList(u.id, 550, "FAVORITE", true);
    expect(await getListIds(u.id, "FAVORITE")).toEqual([550]);
    await setInList(u.id, 550, "FAVORITE", false);
    expect(await getListIds(u.id, "FAVORITE")).toEqual([]);
  });

  it("adicionar duas vezes (clique duplo) é idempotente", async () => {
    const u = await makeUser();
    await Promise.all([setInList(u.id, 550, "FAVORITE", true), setInList(u.id, 550, "FAVORITE", true)]);
    expect(await getListIds(u.id, "FAVORITE")).toEqual([550]);
  });

  it("remover item inexistente não falha", async () => {
    const u = await makeUser();
    await expect(setInList(u.id, 1, "WATCHLIST", false)).resolves.toBeUndefined();
  });

  it("listas são separadas por tipo e por usuário, mais recente primeiro", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await setInList(a.id, 1, "WATCHLIST", true);
    await setInList(a.id, 2, "WATCHLIST", true);
    await setInList(b.id, 3, "WATCHLIST", true);
    expect(await getListIds(a.id, "WATCHLIST")).toEqual([2, 1]);
    expect(await getMembership(a.id, 1)).toEqual({ favorite: false, watchlist: true });
  });

  it("setUserProviders substitui o conjunto", async () => {
    const u = await makeUser();
    await setUserProviders(u.id, [8, 119]);
    await setUserProviders(u.id, [119, 337, 337]);
    expect((await getUserProviders(u.id)).sort()).toEqual([119, 337]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- tests/integration/lists.test.ts`
Expected: FAIL (módulo `@/lib/lists` não existe)

- [ ] **Step 4: Implementar `lists.ts`**

`src/lib/lists.ts`:
```ts
import { db } from "@/lib/db";

export type ListKind = "FAVORITE" | "WATCHLIST";

export async function setInList(userId: string, tmdbId: number, type: ListKind, on: boolean): Promise<void> {
  if (on) {
    await db.listItem.createMany({ data: [{ userId, tmdbId, type }], skipDuplicates: true });
  } else {
    await db.listItem.deleteMany({ where: { userId, tmdbId, type } });
  }
}

export async function getListIds(userId: string, type: ListKind): Promise<number[]> {
  const rows = await db.listItem.findMany({
    where: { userId, type }, orderBy: { createdAt: "desc" }, select: { tmdbId: true },
  });
  return rows.map((r) => r.tmdbId);
}

export async function getMembership(userId: string, tmdbId: number) {
  const rows = await db.listItem.findMany({ where: { userId, tmdbId }, select: { type: true } });
  return {
    favorite: rows.some((r) => r.type === "FAVORITE"),
    watchlist: rows.some((r) => r.type === "WATCHLIST"),
  };
}

export async function getUserProviders(userId: string): Promise<number[]> {
  const rows = await db.userProvider.findMany({ where: { userId }, select: { providerId: true } });
  return rows.map((r) => r.providerId);
}

export async function setUserProviders(userId: string, providerIds: number[]): Promise<void> {
  const unique = [...new Set(providerIds)];
  await db.$transaction([
    db.userProvider.deleteMany({ where: { userId } }),
    db.userProvider.createMany({ data: unique.map((providerId) => ({ userId, providerId })) }),
  ]);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- tests/integration/lists.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 6: Server Action, botões e página**

`src/app/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { setInList, type ListKind } from "@/lib/lists";

export async function toggleList(tmdbId: number, type: ListKind, on: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "unauthenticated" as const };
  await setInList(session.user.id, tmdbId, type, on);
  revalidatePath("/minha-lista");
  return { ok: true as const };
}
```

`src/components/ListButtons.tsx`:
```tsx
"use client";
import { useOptimistic, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toggleList } from "@/app/actions";
import type { ListKind } from "@/lib/lists";

type State = { favorite: boolean; watchlist: boolean };

export function ListButtons({ tmdbId, initial, loggedIn }: { tmdbId: number; initial: State; loggedIn: boolean }) {
  const [state, setState] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const click = (key: keyof State, type: ListKind) => {
    if (!loggedIn) {
      window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`;
      return;
    }
    const next = { ...state, [key]: !state[key] };
    setError(null);
    start(async () => {
      setOptimistic(next);
      try {
        const r = await toggleList(tmdbId, type, next[key]);
        if (r.ok) setState(next);
        else setError("Faça login novamente.");
      } catch {
        setError("Não foi possível salvar. Tente de novo.");
      }
    });
  };

  const cls = (on: boolean) => `rounded px-3 py-1 text-sm ${on ? "bg-white text-black" : "bg-neutral-800"}`;
  return (
    <div className="flex items-center gap-2">
      <button disabled={pending} onClick={() => click("favorite", "FAVORITE")} aria-pressed={optimistic.favorite} className={cls(optimistic.favorite)}>
        {optimistic.favorite ? "♥ Favorito" : "♡ Favoritar"}
      </button>
      <button disabled={pending} onClick={() => click("watchlist", "WATCHLIST")} aria-pressed={optimistic.watchlist} className={cls(optimistic.watchlist)}>
        {optimistic.watchlist ? "✓ Quero assistir" : "+ Quero assistir"}
      </button>
      {error && <span role="alert" className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
```

Em `src/app/filme/[id]/page.tsx`: adicione imports
```tsx
import { auth } from "@/auth";
import { ListButtons } from "@/components/ListButtons";
import { getMembership } from "@/lib/lists";
```
no início de `FilmePage`, depois de `load`:
```tsx
  const session = await auth();
  const membership = session?.user?.id
    ? await getMembership(session.user.id, movie.id)
    : { favorite: false, watchlist: false };
```
e troque `{/* Task 10: <ListButtons /> */}` por:
```tsx
          <ListButtons tmdbId={movie.id} initial={membership} loggedIn={!!session?.user} />
```

`src/app/minha-lista/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MovieCard } from "@/components/MovieCard";
import { getListIds, type ListKind } from "@/lib/lists";
import { details } from "@/lib/tmdb/catalog";

async function Section({ userId, type, title }: { userId: string; type: ListKind; title: string }) {
  const ids = await getListIds(userId, type);
  const movies = (await Promise.all(ids.map((id) => details(id)))).filter((m) => m !== null);
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {movies.length === 0 ? (
        <p className="text-neutral-400">Sua lista está vazia.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {movies.map((m) => <MovieCard key={m.id} movie={m} />)}
        </div>
      )}
    </section>
  );
}

export default async function MinhaListaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/minha-lista");
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Minha lista</h1>
      <Section userId={session.user.id} type="WATCHLIST" title="Quero assistir" />
      <Section userId={session.user.id} type="FAVORITE" title="Favoritos" />
    </>
  );
}
```

- [ ] **Step 7: Rodar testes e verificar manualmente**

Run: `npm test`
Expected: PASS

Manual: deslogado, clicar "Favoritar" leva ao login e volta ao filme; logado, favoritar muda o botão na hora e o filme aparece em `/minha-lista`; clicar de novo remove.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: favoritos e lista quero assistir"
```

---

### Task 11: Meus serviços e filtro padrão do catálogo

**Files:**
- Create: `src/app/conta/page.tsx`, `src/lib/default-filters.ts`
- Modify: `src/app/actions.ts`, `src/app/page.tsx`
- Test: `tests/unit/default-filters.test.ts`

**Interfaces:**
- Consumes: `getUserProviders`, `setUserProviders` (Task 10); `parseFilters`, `hasProviderParam`, `SearchParams`, `CatalogFilters` (Task 4); `getProviders` (Task 5).
- Produces:
  - `resolveFilters(sp: SearchParams, savedProviders: number[] | null): CatalogFilters` em `src/lib/default-filters.ts` — se `servicos` não estiver na URL e houver serviços salvos, usa os salvos.
  - `saveProviders(formData: FormData): Promise<void>` em `src/app/actions.ts` (lê todos os campos `provider`).

- [ ] **Step 1: Escrever o teste falhando**

`tests/unit/default-filters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveFilters } from "@/lib/default-filters";

describe("resolveFilters", () => {
  it("usa serviços salvos quando a URL não tem servicos", () => {
    expect(resolveFilters({ genero: "28" }, [8, 119])).toMatchObject({ providers: [8, 119], genre: 28 });
  });
  it("URL com servicos tem prioridade sobre os salvos", () => {
    expect(resolveFilters({ servicos: "337" }, [8]).providers).toEqual([337]);
  });
  it("servicos= vazio na URL significa todos, mesmo com salvos", () => {
    expect(resolveFilters({ servicos: "" }, [8]).providers).toEqual([]);
  });
  it("visitante (null) ou sem salvos segue a URL", () => {
    expect(resolveFilters({}, null).providers).toEqual([]);
    expect(resolveFilters({}, []).providers).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/unit/default-filters.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

`src/lib/default-filters.ts`:
```ts
import { hasProviderParam, parseFilters, type CatalogFilters, type SearchParams } from "@/lib/filters";

export function resolveFilters(sp: SearchParams, savedProviders: number[] | null): CatalogFilters {
  const f = parseFilters(sp);
  if (!hasProviderParam(sp) && savedProviders?.length) return { ...f, providers: savedProviders };
  return f;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/unit/default-filters.test.ts`
Expected: PASS

- [ ] **Step 5: Ligar ao catálogo, criar a página e a action**

Em `src/app/page.tsx`, troque o componente `Home` por:
```tsx
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await auth();
  const saved = session?.user?.id ? await getUserProviders(session.user.id) : null;
  return <CatalogPage filters={resolveFilters(sp, saved)} />;
}
```
com imports:
```tsx
import { auth } from "@/auth";
import { resolveFilters } from "@/lib/default-filters";
import { getUserProviders } from "@/lib/lists";
```
e remova `parseFilters` do import de `@/lib/filters` (continua usando `filtersToQuery`, `CatalogFilters`, `SearchParams`).

Em `src/app/actions.ts`, adicione:
```ts
import { redirect } from "next/navigation";
import { setUserProviders } from "@/lib/lists";

export async function saveProviders(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/conta");
  const ids = formData.getAll("provider").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  await setUserProviders(session.user.id, ids);
  revalidatePath("/");
  redirect("/conta?salvo=1");
}
```

`src/app/conta/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveProviders } from "@/app/actions";
import type { SearchParams } from "@/lib/filters";
import { getUserProviders } from "@/lib/lists";
import { getProviders } from "@/lib/tmdb/catalog";

export default async function ContaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/conta");
  const [providers, saved, sp] = await Promise.all([getProviders(), getUserProviders(session.user.id), searchParams]);

  return (
    <form action={saveProviders} className="space-y-6">
      <h1 className="text-2xl font-bold">Meus serviços</h1>
      <p className="text-neutral-400">O catálogo abrirá filtrado por estes serviços.</p>
      {sp.salvo && <p role="status" className="text-green-400">Serviços salvos.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {providers.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded bg-neutral-900 px-3 py-2">
            <input type="checkbox" name="provider" value={p.id} defaultChecked={saved.includes(p.id)} />
            {p.name}
          </label>
        ))}
      </div>
      <button className="rounded bg-white px-4 py-2 text-black">Salvar</button>
    </form>
  );
}
```

- [ ] **Step 6: Rodar testes e verificar manualmente**

Run: `npm test`
Expected: PASS

Manual: logado, marcar Netflix em `/conta` e salvar → "Serviços salvos." → `/` abre com Netflix selecionado. "Limpar filtros" mostra todos os serviços.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: meus serviços e filtro padrão do catálogo"
```

---

### Task 12: Testes E2E com TMDB mockado

**Files:**
- Create: `playwright.config.ts`, `e2e/mock-tmdb.ts`, `e2e/catalogo.spec.ts`, `src/instrumentation.ts`
- Test: `e2e/catalogo.spec.ts`

**Interfaces:**
- Consumes: todas as páginas; fixture `tests/fixtures/movie-details.json`.
- Produces: `npm run e2e` rodando os fluxos sem acesso à rede.

As chamadas ao TMDB acontecem no servidor Next, então o mock precisa rodar dentro do processo do servidor: usamos `instrumentation.ts` para ligar um servidor MSW quando `E2E_MOCK_TMDB=1`.

- [ ] **Step 1: Instalar Playwright**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Mock do TMDB no servidor**

`e2e/mock-tmdb.ts`:
```ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import details from "../tests/fixtures/movie-details.json";

const B = "https://api.themoviedb.org/3";
const movie = (id: number, title: string) =>
  ({ id, title, release_date: "2020-01-01", vote_average: 7.5, poster_path: null });

export const mockServer = setupServer(
  http.get(`${B}/discover/movie`, ({ request }) => {
    const providers = new URL(request.url).searchParams.get("with_watch_providers");
    const results = providers === "8" ? [movie(1, "Só na Netflix")] : [movie(550, "Clube da Luta"), movie(1, "Só na Netflix")];
    return HttpResponse.json({ page: 1, total_pages: 1, results });
  }),
  http.get(`${B}/search/movie`, () => HttpResponse.json({ page: 1, total_pages: 1, results: [movie(550, "Clube da Luta")] })),
  http.get(`${B}/movie/550`, () => HttpResponse.json(details)),
  http.get(`${B}/movie/:id`, () => new HttpResponse(null, { status: 404 })),
  http.get(`${B}/genre/movie/list`, () => HttpResponse.json({ genres: [{ id: 18, name: "Drama" }] })),
  http.get(`${B}/watch/providers/movie`, () => HttpResponse.json({ results: [
    { provider_id: 8, provider_name: "Netflix", logo_path: null, display_priorities: { BR: 1 } },
    { provider_id: 119, provider_name: "Amazon Prime Video", logo_path: null, display_priorities: { BR: 2 } },
  ] })),
);
```

`src/instrumentation.ts`:
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.E2E_MOCK_TMDB === "1") {
    const { mockServer } = await import("../e2e/mock-tmdb");
    mockServer.listen({ onUnhandledRequest: "bypass" });
  }
}
```

- [ ] **Step 3: Config do Playwright**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { E2E_MOCK_TMDB: "1" },
  },
});
```
(O build usa o `.env.local`; o banco precisa estar acessível porque as páginas chamam `auth()`.)

- [ ] **Step 4: Escrever os testes E2E**

`e2e/catalogo.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("catálogo lista filmes e filtra por serviço", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Clube da Luta")).toBeVisible();
  await page.getByRole("button", { name: "Netflix" }).click();
  await expect(page).toHaveURL(/servicos=8/);
  await expect(page.getByText("Só na Netflix")).toBeVisible();
  await expect(page.getByText("Clube da Luta")).toHaveCount(0);
});

test("rodapé mostra atribuição do TMDB", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/não é endossado nem certificado pelo TMDB/)).toBeVisible();
});

test("busca leva aos detalhes com onde assistir", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Buscar filme").fill("clube");
  await page.getByLabel("Buscar filme").press("Enter");
  await page.getByRole("link", { name: /Clube da Luta/ }).click();
  await expect(page.getByRole("heading", { name: "Clube da Luta" })).toBeVisible();
  await expect(page.getByText("Amazon Prime Video")).toBeVisible();
  await expect(page.getByTitle("Trailer de Clube da Luta")).toBeVisible();
});

test("busca vazia pede um título", async ({ page }) => {
  await page.goto("/busca?q=%20%20");
  await expect(page.getByText("Digite um título para buscar.")).toBeVisible();
});

test("filme inexistente mostra 404", async ({ page }) => {
  const res = await page.goto("/filme/abc");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Filme não encontrado.")).toBeVisible();
});

test("favoritar sem login redireciona para o login", async ({ page }) => {
  await page.goto("/filme/550");
  await page.getByRole("button", { name: /Favoritar/ }).click();
  await expect(page).toHaveURL(/api\/auth\/signin/);
});
```

O fluxo "logado favorita e vê em Minha lista" já é coberto pelos testes de integração da Task 10 e pela verificação manual; automatizá-lo exigiria um provedor de login falso, fora do escopo da v1.

- [ ] **Step 5: Rodar**

Run: `npm run e2e`
Expected: 6 testes PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: E2E com TMDB mockado"
```

---

### Task 13: Deploy na Vercel

**Files:**
- Modify: `package.json` (script `postinstall`)

- [ ] **Step 1: Gerar o Prisma Client no build**

Em `package.json`, adicione ao `scripts`: `"postinstall": "prisma generate"`.

- [ ] **Step 2: Verificar build local**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: prisma generate no postinstall"
```

- [ ] **Step 4: Publicar**

1. Suba o repositório para o GitHub.
2. Em https://vercel.com, importe o repositório.
3. Configure as variáveis de `.env.example` com os valores de produção (`DATABASE_URL` do Neon de produção).
4. Adicione o redirect de produção no Google OAuth: `https://<seu-dominio>/api/auth/callback/google`.
5. Rode `npx prisma migrate deploy` apontando para o banco de produção.
6. Abra o site publicado e repita a verificação manual das Tasks 6–11.
