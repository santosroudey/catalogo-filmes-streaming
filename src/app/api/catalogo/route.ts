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
