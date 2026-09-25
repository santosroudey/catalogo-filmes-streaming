import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MovieCard } from "@/components/MovieCard";
import { getListIds, type ListKind } from "@/lib/lists";
import { details } from "@/lib/tmdb/catalog";

async function Section({ userId, type, title }: { userId: string; type: ListKind; title: string }) {
  const ids = await getListIds(userId, type);
  const movies = (await Promise.all(ids.map((id) => details(id)))).filter((m) => m !== null);
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {movies.length === 0 ? (
        <p className="text-neutral-400">Sua lista está vazia.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {movies.map((m) => <MovieCard key={m.id} movie={m} />)}
        </div>
      )}
    </section>
  );
}

export default async function MinhaListaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/minha-lista");
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Minha lista</h1>
      <Section userId={session.user.id} type="WATCHLIST" title="Quero assistir" />
      <Section userId={session.user.id} type="FAVORITE" title="Favoritos" />
    </>
  );
}
