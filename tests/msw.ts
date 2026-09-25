import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { TMDB_BASE } from "@/lib/tmdb/client";

export const server = setupServer();
export const tmdb = (path: string) => TMDB_BASE + path;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
