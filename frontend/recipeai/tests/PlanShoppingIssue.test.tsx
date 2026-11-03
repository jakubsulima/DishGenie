import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import PlanShoppingIssue from "../src/components/PlanShoppingIssue";
import { reportPlanShoppingIssue, type MealPlan } from "../src/lib/mealPlans";
vi.mock("../src/lib/mealPlans", () => ({ reportPlanShoppingIssue: vi.fn() }));
const plan: MealPlan = { id: "plan", version: 4, createdAt: "2026-11-03T10:00:00Z", plan: { schemaVersion: 2, status: "ACCEPTED", slots: [], shopping: null, settings: { requestId: "plan", startDate: "2026-11-03", dayCount: 7, servings: 2, mealTypes: ["DINNER"], stores: ["LIDL"], budget: null, locale: "pl", maxMinutes: 45 } } };
test("reports a price issue without replacing the plan and links to its meal", async () => {
  vi.mocked(reportPlanShoppingIssue).mockResolvedValue({ id: "report" });
  render(<LanguageProvider initialLocale="pl"><PlanShoppingIssue plan={plan} itemKey="rice" slotId="meal" disabled={false} /></LanguageProvider>);
  fireEvent.click(screen.getByText("Brak produktu lub inna cena?"));
  fireEvent.change(screen.getByLabelText("Co się stało?"), { target: { value: "PRICE_DIFFERENT" } });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zgłoszenie" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Zgłoszenie zapisane");
  expect(reportPlanShoppingIssue).toHaveBeenCalledWith(plan, "rice", "PRICE_DIFFERENT", expect.any(String));
  expect(screen.getByRole("link")).toHaveAttribute("href", "#meal-slot-meal");
});
