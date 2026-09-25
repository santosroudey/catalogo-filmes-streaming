import { describe, it, expect } from "vitest";
import { parseToggleInput } from "@/lib/lists-input";

describe("parseToggleInput", () => {
  it("aceita entrada válida", () => {
    expect(parseToggleInput(550, "FAVORITE", true)).toEqual({ tmdbId: 550, type: "FAVORITE", on: true });
  });

  it.each([
    [-1, "FAVORITE", true],
    [0, "FAVORITE", true],
    [1.5, "FAVORITE", true],
    [Number.MAX_SAFE_INTEGER + 10, "FAVORITE", true],
    [550, "OTHER", true],
    [550, "FAVORITE", "yes"],
    ["550", "FAVORITE", true],
  ] as const)("rejeita tmdbId=%s type=%s on=%s", (tmdbId, type, on) => {
    expect(parseToggleInput(tmdbId, type, on)).toBeNull();
  });
});
