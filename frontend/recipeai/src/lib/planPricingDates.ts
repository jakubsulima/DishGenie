import { localDateInput, type MealPlan } from "./mealPlans";

export function planPricingDates(plan: MealPlan) {
  const today = localDateInput();
  const week = localDateInput(7);
  const fallback = plan.plan.settings.startDate >= today ? plan.plan.settings.startDate : week;
  const first = plan.plan.slots.filter(s => s.recipe && !s.skipped && s.date >= today).map(s => s.date).sort()[0] ?? fallback;
  const latest = first < week ? first : week;
  return { today, latest, allows: (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date <= latest };
}
