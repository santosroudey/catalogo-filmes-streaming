"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { setInList, type ListKind } from "@/lib/lists";

export async function toggleList(tmdbId: number, type: ListKind, on: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "unauthenticated" as const };
  await setInList(session.user.id, tmdbId, type, on);
  revalidatePath("/minha-lista");
  return { ok: true as const };
}
