"use client";
import { useEffect, useRef, useState } from "react";
import type { Movie, Page } from "@/lib/tmdb/types";
import { MovieCard } from "./MovieCard";

export function MovieGrid({ initial, query }: { initial: Page<Movie>; query: string }) {
  const [movies, setMovies] = useState(initial.results);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = page < initial.totalPages;

  useEffect(() => { setMovies(initial.results); setPage(initial.page); setFailed(false); }, [initial]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || failed) return;
    const obs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loading) return;
      setLoading(true);
      try {
        const sep = query ? "&" : "";
        const res = await fetch(`/api/catalogo?${query}${sep}pagina=${page + 1}`);
        if (!res.ok) throw new Error();
        const next: Page<Movie> = await res.json();
        setMovies((m) => [...m, ...next.results.filter((n) => !m.some((x) => x.id === n.id))]);
        setPage(next.page);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: "600px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page, hasMore, loading, failed, query]);

  if (movies.length === 0) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {movies.map((m) => <MovieCard key={m.id} movie={m} />)}
      </div>
      <div ref={sentinel} className="h-10" />
      {loading && <p className="text-center text-neutral-400">Carregando…</p>}
      {failed && (
        <button onClick={() => setFailed(false)} className="mx-auto block rounded bg-neutral-800 px-4 py-2">
          Erro ao carregar mais. Tentar novamente
        </button>
      )}
    </>
  );
}
