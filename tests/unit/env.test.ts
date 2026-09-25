import { describe, it, expect } from "vitest";
import { parseEnv } from "@/env";

const valid = {
  TMDB_READ_TOKEN: "t", DATABASE_URL: "postgresql://x", AUTH_SECRET: "s",
  AUTH_GOOGLE_ID: "g", AUTH_GOOGLE_SECRET: "gs", AUTH_RESEND_KEY: "r", EMAIL_FROM: "a@b.com",
};

describe("parseEnv", () => {
  it("aceita ambiente completo", () => {
    expect(parseEnv(valid).TMDB_READ_TOKEN).toBe("t");
  });
  it("falha nomeando a variável ausente", () => {
    const { TMDB_READ_TOKEN, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/TMDB_READ_TOKEN/);
  });
});
