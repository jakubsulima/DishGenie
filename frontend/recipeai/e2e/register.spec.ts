import { expect, test } from "@playwright/test";
import { mockGuestApi, mockRegisterApi } from "./apiMocks";

const fillRegisterForm = async (page: import("@playwright/test").Page) => {
  const emailInput = page.locator("#email");
  const passwordInput = page.locator("#password");
  const confirmPasswordInput = page.locator("#confirmPassword");

  await emailInput.fill("chef@example.com");
  await passwordInput.fill("Password1!");
  await confirmPasswordInput.fill("Password1!");

  await expect(emailInput).toHaveValue("chef@example.com");
  await expect(passwordInput).toHaveValue("Password1!");
  await expect(confirmPasswordInput).toHaveValue("Password1!");
};

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

  await fillRegisterForm(page);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Show me 3 ideas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});

test("guest dinner choices continue after registration", async ({ page }) => {
  await mockRegisterApi(page);
  await page.goto("/");

  await page
    .getByPlaceholder("eggs, rice, spinach, chicken")
    .fill("eggs and rice");
  await page.getByRole("button", { name: "Tired weeknight" }).click();
  await page.getByRole("button", { name: "Tune details" }).click();
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await page.getByRole("button", { name: "Get my 3 dinner ideas" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Create one" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByText("Your dinner idea is saved.")).toBeVisible();
  await expect(page.getByText(/eggs and rice$/i)).toBeVisible();

  await fillRegisterForm(page);
  await page.getByRole("button", { name: "Create account" }).click();

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
