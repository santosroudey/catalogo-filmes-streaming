"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { setInList, setUserProviders, type ListKind } from "@/lib/lists";

export async function toggleList(tmdbId: number, type: ListKind, on: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "unauthenticated" as const };
  await setInList(session.user.id, tmdbId, type, on);
  revalidatePath("/minha-lista");
  return { ok: true as const };
}

export async function saveProviders(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/conta");
  const ids = formData.getAll("provider").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  await setUserProviders(session.user.id, ids);
  revalidatePath("/");
  redirect("/conta?salvo=1");
}
