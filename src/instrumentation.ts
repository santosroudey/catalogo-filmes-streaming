// E2E_MOCK_TMDB gates an MSW server that intercepts outgoing TMDB requests and
// serves fixture data instead, so the E2E suite (which runs against `next
// start`, i.e. NODE_ENV=production) doesn't depend on network access or a
// real TMDB API key. Checking NODE_ENV !== "production" here would NOT work,
// since that's exactly the mode the E2E suite runs in.
//
// This variable must never be set in a deployed/production environment: doing
// so would silently replace real TMDB responses with mock fixtures for real
// users. It intentionally is NOT listed in .env.example so it can't be copied
// into a real deployment's environment by accident; it is only ever set by
// the E2E test runner itself.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.E2E_MOCK_TMDB === "1") {
    const { mockServer } = await import("../e2e/mock-tmdb");
    mockServer.listen({ onUnhandledRequest: "bypass" });
  }
}
