"use client";
import { useRouter } from "next/navigation";
import { filtersToQuery, type CatalogFilters } from "@/lib/filters";
import type { Genre, Provider } from "@/lib/tmdb/types";

export function Filters({ providers, genres, value }: { providers: Provider[]; genres: Genre[]; value: CatalogFilters }) {
  const router = useRouter();
  const go = (f: CatalogFilters) => {
    // "servicos=" vazio preserva a escolha explícita de "nenhum serviço" (Task 11)
    const q = filtersToQuery({ ...f, page: 1 });
    router.push(f.providers.length ? `/?${q}` : `/?servicos=${q ? "&" + q : ""}`);
  };
  const toggle = (id: number) =>
    go({ ...value, providers: value.providers.includes(id) ? value.providers.filter((p) => p !== id) : [...value.providers, id] });
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const years = Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - i);

  return (
    <section className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {providers.slice(0, 20).map((p) => (
          <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={value.providers.includes(p.id)}
            className={`rounded-full border px-3 py-1 text-sm ${value.providers.includes(p.id) ? "border-white bg-white text-black" : "border-neutral-600"}`}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <select aria-label="Gênero" value={value.genre ?? ""} onChange={(e) => go({ ...value, genre: num(e.target.value) })}
          className="rounded bg-neutral-800 px-2 py-1">
          <option value="">Todos os gêneros</option>
          {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select aria-label="Ano" value={value.year ?? ""} onChange={(e) => go({ ...value, year: num(e.target.value) })}
          className="rounded bg-neutral-800 px-2 py-1">
          <option value="">Qualquer ano</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Nota mínima" value={value.minRating ?? ""} onChange={(e) => go({ ...value, minRating: num(e.target.value) })}
          className="rounded bg-neutral-800 px-2 py-1">
          <option value="">Qualquer nota</option>
          {[5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}+</option>)}
        </select>
        <button onClick={() => router.push("/?servicos=")} className="underline">Limpar filtros</button>
      </div>
    </section>
  );
}
