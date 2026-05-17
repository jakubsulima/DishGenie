import { expect, test } from "@playwright/test";
import { mockLoginApi } from "./apiMocks";

test("user can sign in with email and password", async ({ page }) => {
  await mockLoginApi(page);
  await page.goto("/login");

  await page.getByLabel("Email").fill("chef@example.com");
  await page.getByLabel("Password").fill("Password1!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Generate Recipe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});
