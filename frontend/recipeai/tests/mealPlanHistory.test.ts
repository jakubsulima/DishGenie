import { beforeEach, expect, test, vi } from "vitest";
import { apiClient } from "../src/lib/hooks";
import { listMealPlans, preferredMealPlan, localDateInput, type PlanSummary } from "../src/lib/mealPlans";
vi.mock("../src/lib/hooks", () => ({ apiClient: vi.fn(), ensureCsrfToken: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
const summary = (id: string, startDate: string): PlanSummary => ({ id, startDate, dayCount: 7, plannedSlots: 1, totalSlots: 14, status: "DRAFT", version: 0 });

test("loads the current week even when it is older than the first twenty summaries", async () => {
  const recent = Array.from({ length: 20 }, (_, i) => summary(`future-${i}`, localDateInput(10 + i)));
  const current = summary("older-current-week", localDateInput());
  vi.mocked(apiClient).mockResolvedValueOnce(recent).mockResolvedValueOnce([current]);
  const list = await listMealPlans();
  expect(list).toHaveLength(21);
  expect(preferredMealPlan(list)?.id).toBe(current.id);
  expect(apiClient).toHaveBeenNthCalledWith(1, "v3/meal-plans");
  expect(apiClient).toHaveBeenNthCalledWith(2, "v3/meal-plans?page=1");
});

test("an older server ignoring pagination cannot trigger an endless history loop", async () => {
  const batch = Array.from({ length: 20 }, (_, i) => summary(String(i), localDateInput()));
  vi.mocked(apiClient).mockResolvedValue(batch);
  expect(await listMealPlans()).toHaveLength(20);
  expect(apiClient).toHaveBeenCalledTimes(2);
});
