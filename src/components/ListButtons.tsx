"use client";
import { useOptimistic, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toggleList } from "@/app/actions";
import type { ListKind } from "@/lib/lists";

type State = { favorite: boolean; watchlist: boolean };

export function ListButtons({ tmdbId, initial, loggedIn }: { tmdbId: number; initial: State; loggedIn: boolean }) {
  const [state, setState] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const click = (key: keyof State, type: ListKind) => {
    if (!loggedIn) {
      window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`;
      return;
    }
    const next = { ...state, [key]: !state[key] };
    setError(null);
    start(async () => {
      setOptimistic(next);
      try {
        const r = await toggleList(tmdbId, type, next[key]);
        if (r.ok) setState(next);
        else setError("Faça login novamente.");
      } catch {
        setError("Não foi possível salvar. Tente de novo.");
      }
    });
  };

  const cls = (on: boolean) => `rounded px-3 py-1 text-sm ${on ? "bg-white text-black" : "bg-neutral-800"}`;
  return (
    <div className="flex items-center gap-2">
      <button disabled={pending} onClick={() => click("favorite", "FAVORITE")} aria-pressed={optimistic.favorite} className={cls(optimistic.favorite)}>
        {optimistic.favorite ? "♥ Favorito" : "♡ Favoritar"}
      </button>
      <button disabled={pending} onClick={() => click("watchlist", "WATCHLIST")} aria-pressed={optimistic.watchlist} className={cls(optimistic.watchlist)}>
        {optimistic.watchlist ? "✓ Quero assistir" : "+ Quero assistir"}
      </button>
      {error && <span role="alert" className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
