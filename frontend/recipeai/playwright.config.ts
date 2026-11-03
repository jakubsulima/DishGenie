import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localPort = process.env.PLAYWRIGHT_PORT || "5173";
const baseURL = externalBaseURL || `http://127.0.0.1:${localPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${localPort}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
