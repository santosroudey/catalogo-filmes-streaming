import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ListButtons } from "@/components/ListButtons";
import { parseMovieId } from "@/lib/ids";
import { getMembership } from "@/lib/lists";
import { details } from "@/lib/tmdb/catalog";

type Props = { params: Promise<{ id: string }> };

async function load(params: Props["params"]) {
  const id = parseMovieId((await params).id);
  const movie = id ? await details(id) : null;
  if (!movie) notFound();
  return movie;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await load(params);
  return { title: `${movie.title} — onde assistir`, description: movie.overview.slice(0, 160) };
}

export default async function FilmePage({ params }: Props) {
  const movie = await load(params);
  const session = await auth();
  const membership = session?.user?.id
    ? await getMembership(session.user.id, movie.id)
    : { favorite: false, watchlist: false };
  return (
    <article className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="relative aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
          {movie.posterUrl
            ? <Image src={movie.posterUrl} alt={movie.title} fill sizes="192px" className="object-cover" priority />
            : <div className="flex h-full items-center justify-center text-sm text-neutral-400">Sem imagem</div>}
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">{movie.title}</h1>
          <p className="text-neutral-400">
            {[movie.year, movie.runtime ? `${movie.runtime} min` : null, movie.genres.map((g) => g.name).join(", ")]
              .filter(Boolean).join(" · ")} · ★ {movie.rating.toFixed(1)}
          </p>
          <ListButtons tmdbId={movie.id} initial={membership} loggedIn={!!session?.user} />
          <p className="max-w-2xl">{movie.overview}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Onde assistir</h2>
        {movie.providers.length === 0 ? (
          <p className="text-neutral-400">Este filme não está em nenhum streaming no Brasil agora.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {movie.providers.map((p) => (
              <a key={p.id} href={movie.watchLink ?? "#"} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded bg-neutral-800 px-3 py-2">
                {p.logoUrl && <Image src={p.logoUrl} alt="" width={28} height={28} className="rounded" />}
                {p.name}
              </a>
            ))}
          </div>
        )}
        {movie.providers.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">Dados de disponibilidade: JustWatch.</p>
        )}
      </section>

      {movie.trailerKey && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Trailer</h2>
          <div className="aspect-video max-w-3xl">
            <iframe className="h-full w-full rounded" src={`https://www.youtube-nocookie.com/embed/${movie.trailerKey}`}
              title={`Trailer de ${movie.title}`} allowFullScreen />
          </div>
        </section>
      )}

      {movie.cast.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Elenco</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {movie.cast.map((c, i) => (
              <li key={`${i}-${c.name}`} className="text-sm">
                <p className="font-medium">{c.name}</p>
                <p className="text-neutral-400">{c.character}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
