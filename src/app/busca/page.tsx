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
