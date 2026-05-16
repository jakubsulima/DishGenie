import { expect, test } from "@playwright/test";
import { mockProfileApi } from "./apiMocks";

test("user can update diet and disliked ingredients on profile", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.goto("/My Profile");

  await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
  await expect(page.getByText("anchovies")).toBeVisible();

  await page.getByRole("checkbox", { name: /vegetarian/i }).click();
  await expect(page.getByText("Diet: Vegetarian")).toBeVisible();

  await page.getByPlaceholder("e.g., Olives").fill("Mushrooms");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("mushrooms")).toBeVisible();
  await expect(page.getByText("Ingredient added")).toBeVisible();
});
