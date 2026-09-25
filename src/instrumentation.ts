export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.E2E_MOCK_TMDB === "1") {
    const { mockServer } = await import("../e2e/mock-tmdb");
    mockServer.listen({ onUnhandledRequest: "bypass" });
  }
}
