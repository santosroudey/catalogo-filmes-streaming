import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/lib/tmdb/types";

export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Link href={`/filme/${movie.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-neutral-800">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width: 640px) 50vw, 200px"
            className="object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">Sem imagem</div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium">{movie.title}</h3>
      <p className="text-xs text-neutral-400">
        {movie.year ?? "—"} · ★ {movie.rating.toFixed(1)}
      </p>
    </Link>
  );
}
