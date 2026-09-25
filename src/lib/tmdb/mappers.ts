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
