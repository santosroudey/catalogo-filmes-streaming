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

  it("limita a espera de Retry-After a 2s mesmo com header alto", async () => {
    let calls = 0;
    server.use(http.get(tmdb("/y"), () => {
      calls++;
      return calls === 1
        ? new HttpResponse(null, { status: 429, headers: { "Retry-After": "60" } })
        : HttpResponse.json({ ok: 1 });
    }));
    const start = Date.now();
    await expect(tmdbFetch("/y", { revalidate: 60 })).resolves.toEqual({ ok: 1 });
    expect(Date.now() - start).toBeLessThan(3000);
    expect(calls).toBe(2);
  });

  it("não repete em 404 e lança TmdbError com status 404", async () => {
    let calls = 0;
    server.use(http.get(tmdb("/x"), () => { calls++; return new HttpResponse(null, { status: 404 }); }));
    const err = (await tmdbFetch("/x", { revalidate: 60 }).catch((e: unknown) => e)) as TmdbError;
    expect(err).toBeInstanceOf(TmdbError);
    expect(err.status).toBe(404);
    expect(calls).toBe(1);
  });
});
