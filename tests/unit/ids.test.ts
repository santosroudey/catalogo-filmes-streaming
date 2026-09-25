import { describe, it, expect } from "vitest";
import { parseMovieId } from "@/lib/ids";

describe("parseMovieId", () => {
  it.each([["550", 550], ["550-clube-da-luta", null], ["abc", null], ["0", null], ["-3", null], ["1.5", null]])(
    "%s → %s", (raw, expected) => expect(parseMovieId(raw)).toBe(expected));
});
