import { beforeEach } from "vitest";
import { db } from "@/lib/db";

// Integration tests run against a real Postgres pointed to by TEST_DATABASE_URL
// (see tests/setup.ts). Without it, there's no database to clean between tests,
// so the cleanup hook is skipped rather than failing on every suite that imports this file.
if (process.env.TEST_DATABASE_URL) {
  beforeEach(async () => {
    await db.listItem.deleteMany();
    await db.userProvider.deleteMany();
    await db.user.deleteMany();
  });
}

export async function makeUser() {
  return db.user.create({ data: { email: `u${Date.now()}${Math.random()}@test.com` } });
}
