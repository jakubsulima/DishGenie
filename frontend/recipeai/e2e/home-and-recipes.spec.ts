import { expect, test } from "@playwright/test";
import { mockGuestApi } from "./apiMocks";

test.beforeEach(async ({ page }) => {
  await mockGuestApi(page);
});

test("guest can land on the homepage and open login from recipe generation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /what can i cook with these ingredients/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /(?:Show me 3 ideas|Get my 3 dinner ideas)/ })).toBeVisible();

  await page
    .getByPlaceholder("eggs, rice, spinach, chicken")
    .fill("extra lemon");
  await page.getByRole("button", { name: "Tired weeknight" }).click();
  await page.getByRole("button", { name: "Tune details" }).click();
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(
    page.getByPlaceholder("eggs, rice, spinach, chicken"),
  ).toHaveValue("extra lemon");

  await page.getByRole("button", { name: "Get my 3 dinner ideas" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("guest can browse latest public recipes", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Browse latest public recipes" }).click();

  await expect(page).toHaveURL(/\/Recipes$/);
  await expect(
    page.getByRole("heading", { name: "Latest Recipes" }),
  ).toBeVisible();
  await expect(page.getByText("Tomato Basil Pasta")).toBeVisible();
  await expect(page.getByText("Lemon Herb Rice")).toBeVisible();
  await expect(page.getByText("You are browsing as a guest.")).toBeVisible();
});

test("visitor can switch to Polish and the preference survives reload", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "Przełącz język na polski" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Co mogę ugotować z tych składników?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pokaż 3 pomysły na obiad" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Co mogę ugotować z tych składników?" }),
  ).toBeVisible();

  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Polityka prywatności" }),
  ).toBeVisible();
});
