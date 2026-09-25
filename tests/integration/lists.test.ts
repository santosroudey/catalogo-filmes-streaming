import { describe, it, expect } from "vitest";
import { makeUser } from "./db";
import { getListIds, getMembership, setInList, getUserProviders, setUserProviders } from "@/lib/lists";

// Requires a real Postgres database (TEST_DATABASE_URL). See tests/setup.ts and
// tests/integration/db.ts: without it, there's nothing to run these against.
describe.skipIf(!process.env.TEST_DATABASE_URL)("listas", () => {
  it("adiciona e remove de favoritos", async () => {
    const u = await makeUser();
    await setInList(u.id, 550, "FAVORITE", true);
    expect(await getListIds(u.id, "FAVORITE")).toEqual([550]);
    await setInList(u.id, 550, "FAVORITE", false);
    expect(await getListIds(u.id, "FAVORITE")).toEqual([]);
  });

  it("adicionar duas vezes (clique duplo) é idempotente", async () => {
    const u = await makeUser();
    await Promise.all([setInList(u.id, 550, "FAVORITE", true), setInList(u.id, 550, "FAVORITE", true)]);
    expect(await getListIds(u.id, "FAVORITE")).toEqual([550]);
  });

  it("remover item inexistente não falha", async () => {
    const u = await makeUser();
    await expect(setInList(u.id, 1, "WATCHLIST", false)).resolves.toBeUndefined();
  });

  it("listas são separadas por tipo e por usuário, mais recente primeiro", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await setInList(a.id, 1, "WATCHLIST", true);
    await setInList(a.id, 2, "WATCHLIST", true);
    await setInList(b.id, 3, "WATCHLIST", true);
    expect(await getListIds(a.id, "WATCHLIST")).toEqual([2, 1]);
    expect(await getMembership(a.id, 1)).toEqual({ favorite: false, watchlist: true });
  });

  it("setUserProviders substitui o conjunto", async () => {
    const u = await makeUser();
    await setUserProviders(u.id, [8, 119]);
    await setUserProviders(u.id, [119, 337, 337]);
    expect((await getUserProviders(u.id)).sort()).toEqual([119, 337]);
  });
});
