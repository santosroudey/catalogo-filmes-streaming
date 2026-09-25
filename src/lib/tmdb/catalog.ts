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
