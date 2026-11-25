/**
 * Fluxos críticos: proteção das rotas, login, criação de orçamento e assistente até a revisão
 * dos quantitativos (com memória de cálculo). Precisa de um projeto Supabase de teste.
 */
import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_SENHA;

test("rota protegida leva ao login preservando o destino", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fpainel/);
  await expect(page.getByLabel("E-mail")).toBeVisible();
});

test("API de relatórios exige sessão", async ({ request }) => {
  const r = await request.get("/api/relatorios/00000000-0000-4000-8000-000000000000/pdf", { maxRedirects: 0 });
  expect([401, 302, 307]).toContain(r.status());
});

async function entrar(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(EMAIL!);
  await page.getByLabel("Senha").fill(SENHA!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/painel/);
}

test.describe("com usuário de teste", () => {
  test.skip(!EMAIL || !SENHA, "Defina E2E_EMAIL e E2E_SENHA (usuário de teste com empresa) para rodar.");

  test("cria orçamento e percorre o assistente até a revisão dos quantitativos", async ({ page }) => {
    await entrar(page);
    const nome = `E2E ${Date.now()}`;
    await page.getByLabel("Nome da obra").fill(nome);
    await page.getByRole("button", { name: "Novo orçamento" }).click();
    await expect(page).toHaveURL(/\/orcamentos\/[0-9a-f-]+\/assistente/);

    // 1. dados gerais
    await page.getByLabel("UF").selectOption("SP");
    await page.getByRole("button", { name: "Próximo" }).click();
    // 2. terreno: a validação impede avançar sem as medidas
    await page.getByRole("button", { name: "Próximo" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.getByLabel("Largura (frente) (m)").fill("12");
    await page.getByLabel("Profundidade (m)").fill("30");
    await page.getByRole("button", { name: "Próximo" }).click();
    // 3. construção
    await page.getByRole("button", { name: "Próximo" }).click();
    // 4. ambientes pelo atalho
    await page.getByLabel(/Atalho/).fill("3 quartos, 1 suíte, 2 banheiros, sala, cozinha");
    await page.getByRole("button", { name: "Gerar ambientes" }).click();
    await expect(page.getByText("8 ambiente(s)", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Resumo da obra")).toContainText("Área construída");
    for (let passo = 5; passo <= 8; passo++) await page.getByRole("button", { name: "Próximo" }).click();
    // 8. revisão com memória de cálculo
    await expect(page.getByRole("heading", { name: /Revisão dos quantitativos/ })).toBeVisible();
    await expect(page.getByText(/Área construída: .* m²/)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Memória de cálculo/i }).first()).toBeVisible();

    // o rascunho persiste
    await expect(page.getByText("Rascunho salvo")).toBeVisible();
    await page.goto("/painel");
    await expect(page.getByRole("link", { name: nome })).toBeVisible();
  });

  // Caso de aceite 8: exige uma base SINAPI importada para a UF do teste e o mapeamento configurado.
  test("caso de aceite 8: gera a planilha com área gourmet e piscina e exporta o PDF", async ({ page }) => {
    test.skip(process.env.E2E_BASE_IMPORTADA !== "true", "Defina E2E_BASE_IMPORTADA=true quando o projeto de teste tiver base SINAPI importada.");
    const uf = process.env.E2E_UF ?? "SP";
    await entrar(page);
    await page.getByLabel("Nome da obra").fill(`Aceite 8 ${Date.now()}`);
    await page.getByRole("button", { name: "Novo orçamento" }).click();

    await page.getByLabel("UF").selectOption(uf);
    await page.getByLabel("Mês-base SINAPI").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Próximo" }).click();
    await page.getByLabel("Largura (frente) (m)").fill("15");
    await page.getByLabel("Profundidade (m)").fill("30");
    await page.getByRole("button", { name: "Próximo" }).click();
    await page.getByRole("button", { name: "Próximo" }).click();
    await page.getByLabel(/Atalho/).fill("3 quartos, 1 suíte, sala, cozinha, 2 banheiros, área gourmet");
    await page.getByRole("button", { name: "Gerar ambientes" }).click();
    for (let passo = 5; passo <= 7; passo++) await page.getByRole("button", { name: "Próximo" }).click();
    await page.getByLabel("Tem piscina").check();
    await page.getByRole("button", { name: "Próximo" }).click();
    await expect(page.getByRole("heading", { name: /Revisão dos quantitativos/ })).toBeVisible();
    await page.getByRole("button", { name: "Próximo" }).click();
    await page.getByRole("button", { name: "Gerar orçamento" }).click();
    await expect(page.getByText(/Orçamento gerado:/)).toBeVisible({ timeout: 60_000 });

    await page.getByRole("link", { name: "Relatórios PDF / Excel" }).click();
    const id = /\/orcamentos\/([0-9a-f-]+)/.exec(page.url())![1];
    const pdf = await page.request.get(`/api/relatorios/${id}/pdf?tipo=completo`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
