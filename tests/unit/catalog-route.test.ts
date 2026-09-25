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
