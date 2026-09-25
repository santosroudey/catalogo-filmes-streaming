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
