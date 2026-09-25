import { z } from "zod";
import type { ListKind } from "@/lib/lists";

export type ToggleInput = { tmdbId: number; type: ListKind; on: boolean };

const toggleSchema = z.object({
  tmdbId: z.number().int().positive().safe(),
  type: z.enum(["FAVORITE", "WATCHLIST"]),
  on: z.boolean(),
});

export function parseToggleInput(tmdbId: unknown, type: unknown, on: unknown): ToggleInput | null {
  const result = toggleSchema.safeParse({ tmdbId, type, on });
  return result.success ? result.data : null;
}
