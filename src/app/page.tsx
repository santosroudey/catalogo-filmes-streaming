import Link from "next/link";
import { Filters } from "@/components/Filters";
import { MovieGrid } from "@/components/MovieGrid";
import { filtersToQuery, parseFilters, type CatalogFilters, type SearchParams } from "@/lib/filters";
import { discover, getGenres, getProviders } from "@/lib/tmdb/catalog";

async function CatalogPage({ filters }: { filters: CatalogFilters }) {
  const [page, genres, providers] = await Promise.all([discover(filters), getGenres(), getProviders()]);
  const query = filtersToQuery({ ...filters, page: 1 });
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Disponível agora no streaming</h1>
      <Filters providers={providers} genres={genres} value={filters} />
      {page.results.length === 0 ? (
        <p className="text-neutral-400">Nenhum filme com esses filtros. <Link href="/?servicos=" className="underline">Limpar filtros</Link></p>
      ) : (
        <MovieGrid key={query} initial={page} query={query} />
      )}
    </>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return <CatalogPage filters={parseFilters(sp)} />;
}
