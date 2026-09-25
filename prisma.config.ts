import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use the direct (unpooled) Neon connection when available.
// Empty fallback lets `prisma generate` run during install without a database.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
