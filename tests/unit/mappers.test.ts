import { describe, it, expect } from "vitest";
import details from "../fixtures/movie-details.json";
import { toMovie, toMovieDetails, toPage, imageUrl } from "@/lib/tmdb/mappers";
import type { RawDetails } from "@/lib/tmdb/types";

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
    const d = toMovieDetails({ ...(details as unknown as RawDetails), overview: "", videos: { results: [] }, "watch/providers": { results: {} } });
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
