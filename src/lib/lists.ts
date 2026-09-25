import { db } from "@/lib/db";

export type ListKind = "FAVORITE" | "WATCHLIST";

export async function setInList(userId: string, tmdbId: number, type: ListKind, on: boolean): Promise<void> {
  if (on) {
    await db.listItem.createMany({ data: [{ userId, tmdbId, type }], skipDuplicates: true });
  } else {
    await db.listItem.deleteMany({ where: { userId, tmdbId, type } });
  }
}

export async function getListIds(userId: string, type: ListKind): Promise<number[]> {
  const rows = await db.listItem.findMany({
    where: { userId, type }, orderBy: { createdAt: "desc" }, select: { tmdbId: true },
  });
  return rows.map((r) => r.tmdbId);
}

export async function getMembership(userId: string, tmdbId: number) {
  const rows = await db.listItem.findMany({ where: { userId, tmdbId }, select: { type: true } });
  return {
    favorite: rows.some((r) => r.type === "FAVORITE"),
    watchlist: rows.some((r) => r.type === "WATCHLIST"),
  };
}

export async function getUserProviders(userId: string): Promise<number[]> {
  const rows = await db.userProvider.findMany({ where: { userId }, select: { providerId: true } });
  return rows.map((r) => r.providerId);
}

export async function setUserProviders(userId: string, providerIds: number[]): Promise<void> {
  const unique = [...new Set(providerIds)];
  await db.$transaction([
    db.userProvider.deleteMany({ where: { userId } }),
    db.userProvider.createMany({ data: unique.map((providerId) => ({ userId, providerId })) }),
  ]);
}
