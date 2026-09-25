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
