import { expect, test } from "@playwright/test";
import { mockGuestApi, mockRegisterApi } from "./apiMocks";

test("registration form validates required and password rules", async ({
  page,
}) => {
  await mockGuestApi(page);
  await page.goto("/register");

  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Email is required")).toBeVisible();
  await expect(page.getByText("Password is required")).toBeVisible();
  await expect(page.getByText("Confirm Password is required")).toBeVisible();

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("weak");
  await page.getByLabel("Confirm Password").fill("different");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Invalid email format")).toBeVisible();
  await expect(
    page.getByText("Password must be at least 8 characters"),
  ).toBeVisible();
  await expect(page.getByText("Passwords must match")).toBeVisible();
});

test("new user is signed in after registration", async ({ page }) => {
  await mockRegisterApi(page);
  await page.goto("/register");

  await page.getByLabel("Email").fill("chef@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Password1!");
  await page.getByLabel("Confirm Password").fill("Password1!");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Generate Recipe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});
