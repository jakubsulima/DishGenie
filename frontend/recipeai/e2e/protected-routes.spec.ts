import { expect, test } from "@playwright/test";
import { mockGuestApi } from "./apiMocks";

test("guest is redirected to login from protected routes", async ({ page }) => {
  await mockGuestApi(page);

  await page.goto("/Fridge");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
