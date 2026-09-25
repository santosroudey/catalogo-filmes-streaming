import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { E2E_MOCK_TMDB: "1" },
  },
});
