import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra um projeto Supabase DE TESTE (variáveis no ambiente; nada de segredo no código).
 * O fluxo autenticado só roda com E2E_EMAIL e E2E_SENHA definidos (usuário de teste com empresa).
 */
const PORTA = Number(process.env.PORTA_E2E ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${PORTA}` : `npm run dev -- -p ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
