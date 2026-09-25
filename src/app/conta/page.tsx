import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveProviders } from "@/app/actions";
import type { SearchParams } from "@/lib/filters";
import { getUserProviders } from "@/lib/lists";
import { getProviders } from "@/lib/tmdb/catalog";

export default async function ContaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/conta");
  const [providers, saved, sp] = await Promise.all([getProviders(), getUserProviders(session.user.id), searchParams]);

  return (
    <form action={saveProviders} className="space-y-6">
      <h1 className="text-2xl font-bold">Meus serviços</h1>
      <p className="text-neutral-400">O catálogo abrirá filtrado por estes serviços.</p>
      {sp.salvo && <p role="status" className="text-green-400">Serviços salvos.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {providers.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded bg-neutral-900 px-3 py-2">
            <input type="checkbox" name="provider" value={p.id} defaultChecked={saved.includes(p.id)} />
            {p.name}
          </label>
        ))}
      </div>
      <button className="rounded bg-white px-4 py-2 text-black">Salvar</button>
    </form>
  );
}
