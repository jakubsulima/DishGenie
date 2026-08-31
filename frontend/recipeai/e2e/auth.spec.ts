import { expect, test } from "@playwright/test";
import { mockLoginApi } from "./apiMocks";

test("user can sign in with email and password", async ({ page }) => {
  await mockLoginApi(page);
  await page.goto("/login");

  await page.getByLabel("Email").fill("chef@example.com");
  await page.getByLabel("Password").fill("Password1!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Show me 3 ideas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});

test("guest dinner choices continue after sign in", async ({ page }) => {
  await mockLoginApi(page);
  await page.goto("/");

  await page
    .getByPlaceholder("eggs, rice, spinach, chicken")
    .fill("eggs and rice");
  await page.getByRole("button", { name: "Tired weeknight" }).click();
  await page.getByRole("button", { name: "Tune details" }).click();
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await page.getByRole("button", { name: "Get my 3 dinner ideas" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Your dinner idea is saved.")).toBeVisible();
  await expect(page.getByText(/eggs and rice$/i)).toBeVisible();

  await page.getByLabel("Email").fill("chef@example.com");
  await page.getByLabel("Password").fill("Password1!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/Recipe$/);
  await expect(
    page.getByRole("heading", { name: "Choose One Of 3 Different Recipes" }),
  ).toBeVisible();
  await expect(page.getByText("Fastest option")).toBeVisible();
  await expect(page.getByText("Fewest ingredients")).toBeVisible();
  await expect(page.getByText("Most protein")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved Dinner Idea Bowl" }),
  ).toBeVisible();
});

test("logout clears any saved guest dinner idea", async ({ page }) => {
  await mockLoginApi(page);
  await page.goto("/login");

  await page.getByLabel("Email").fill("chef@example.com");
  await page.getByLabel("Password").fill("Password1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

  await page.evaluate(() => {
    sessionStorage.setItem(
      "dishGeniePendingRecipeSearch",
      "quick dinner recipe with stale idea",
    );
  });

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/Login$/);
  await expect(page.getByText("Your dinner idea is saved.")).toBeHidden();
  await expect(page.getByText("quick dinner recipe with stale idea")).toBeHidden();
});
