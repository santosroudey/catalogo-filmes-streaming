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
