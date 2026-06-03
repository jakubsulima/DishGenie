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
      name: /turn what's in your kitchen into dinner/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tell me what to cook" })).toBeVisible();

  await page
    .getByPlaceholder("eggs, rice, spinach, chicken")
    .fill("extra lemon");
  await page.getByRole("button", { name: "Comfort" }).click();
  await page.getByRole("button", { name: "Quick" }).click();
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(
    page.getByPlaceholder("eggs, rice, spinach, chicken"),
  ).toHaveValue("extra lemon");

  await page.getByRole("button", { name: "Tell me what to cook" }).click();

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
