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
      name: /dish genie turns ingredients into recipes/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("Guest mode: what you can do now")).toBeVisible();

  await page.getByRole("button", { name: "Log in to Generate Recipes" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("guest can browse latest public recipes", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Browse 10 Latest Recipes" }).click();

  await expect(page).toHaveURL(/\/Recipes$/);
  await expect(
    page.getByRole("heading", { name: "Latest Recipes" }),
  ).toBeVisible();
  await expect(page.getByText("Tomato Basil Pasta")).toBeVisible();
  await expect(page.getByText("Lemon Herb Rice")).toBeVisible();
  await expect(page.getByText("You are browsing as a guest.")).toBeVisible();
});
