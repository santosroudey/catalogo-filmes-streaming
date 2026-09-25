import { test, expect } from "@playwright/test";

test("catálogo lista filmes e filtra por serviço", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Clube da Luta")).toBeVisible();
  await page.getByRole("button", { name: "Netflix" }).click();
  await expect(page).toHaveURL(/servicos=8/);
  await expect(page.getByText("Só na Netflix")).toBeVisible();
  await expect(page.getByText("Clube da Luta")).toHaveCount(0);
});

test("rodapé mostra atribuição do TMDB", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/não é endossado nem certificado pelo TMDB/)).toBeVisible();
});

test("busca leva aos detalhes com onde assistir", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Buscar filme").fill("clube");
  await page.getByLabel("Buscar filme").press("Enter");
  await page.getByRole("link", { name: /Clube da Luta/ }).click();
  await expect(page.getByRole("heading", { name: "Clube da Luta" })).toBeVisible();
  await expect(page.getByText("Amazon Prime Video")).toBeVisible();
  await expect(page.getByTitle("Trailer de Clube da Luta")).toBeVisible();
});

test("busca vazia pede um título", async ({ page }) => {
  await page.goto("/busca?q=%20%20");
  await expect(page.getByText("Digite um título para buscar.")).toBeVisible();
});

test("filme inexistente mostra 404", async ({ page }) => {
  const res = await page.goto("/filme/abc");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Filme não encontrado.")).toBeVisible();
});

test("favoritar sem login redireciona para o login", async ({ page }) => {
  await page.goto("/filme/550");
  await page.getByRole("button", { name: /Favoritar/ }).click();
  await expect(page).toHaveURL(/api\/auth\/signin/);
});
