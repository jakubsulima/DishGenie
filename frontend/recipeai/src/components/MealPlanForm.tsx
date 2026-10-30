import { useRef, useState, type FormEvent } from "react";
import { useLanguage } from "../context/languageContext";
import { localDateInput, type PlanSettings, type MealType, type PlanStore } from "../lib/mealPlans";

export default function MealPlanForm({ busy, onCreate }: {
  busy: boolean; onCreate: (settings: PlanSettings) => void;
}) {
  const { t, locale } = useLanguage();
  const request = useRef({ signature: "", id: "" });
  const [startDate, setStartDate] = useState(localDateInput);
  const [dayCount, setDayCount] = useState(7);
  const [servings, setServings] = useState(2);
  const [budget, setBudget] = useState("300");
  const [maxMinutes, setMaxMinutes] = useState(45);
  const [meals, setMeals] = useState<MealType[]>(["LUNCH", "DINNER"]);
  const [stores, setStores] = useState<PlanStore[]>(["LIDL", "BIEDRONKA"]);
  const inputClass = "mt-1 w-full rounded-xl border border-primary/20 bg-white p-3 text-primary";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = { startDate, dayCount, servings, budget: Number(budget), maxMinutes, mealTypes: meals, stores, locale };
    const signature = JSON.stringify(fields);
    if (request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    onCreate({ ...fields, requestId: request.current.id });
  };
  return <form onSubmit={submit} className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm sm:p-8">
    <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
      <legend className="mb-4 text-xl font-semibold">{t("Plan your lunches and dinners")}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>{t("Start date")}<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} /></label>
        <label>{t("Number of days")}<input type="number" required min={1} max={7} value={dayCount} onChange={e => setDayCount(Number(e.target.value))} className={inputClass} /></label>
        <label>{t("People")}<input type="number" required min={1} max={100} value={servings} onChange={e => setServings(Number(e.target.value))} className={inputClass} /></label>
        <label>{t("Maximum minutes per meal")}<input type="number" required min={5} max={240} value={maxMinutes} onChange={e => setMaxMinutes(Number(e.target.value))} className={inputClass} /></label>
      </div>
      <fieldset><legend className="mb-2 font-semibold">{t("Meals to plan")}</legend>
        <div className="flex gap-6">{(["LUNCH", "DINNER"] as const).map(meal => <label key={meal} className="flex items-center gap-2">
          <input type="checkbox" checked={meals.includes(meal)} onChange={e => setMeals(current => e.target.checked ? [...current, meal] : current.filter(m => m !== meal))} />
          {t(meal === "LUNCH" ? "Lunch" : "Dinner")}
        </label>)}</div>
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><label htmlFor="plan-budget">{t("Budget for this plan (PLN)")}</label>
          <input id="plan-budget" aria-describedby="plan-budget-help" type="number" required min="0.01" max="100000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} className={inputClass} />
          <p id="plan-budget-help" className="mt-2 text-sm text-primary/70">{t("For the selected meals and days, not all household groceries.")}</p>
        </div>
        <fieldset><legend className="mb-2 font-semibold">{t("Preferred stores")}</legend>
          <div className="flex gap-6">{(["LIDL", "BIEDRONKA"] as const).map(store => <label key={store} className="flex items-center gap-2">
            <input type="checkbox" checked={stores.includes(store)} onChange={e => setStores(current => e.target.checked ? [...current, store] : current.filter(s => s !== store))} />
            {store === "LIDL" ? "Lidl" : "Biedronka"}
          </label>)}</div>
        </fieldset>
      </div>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{t("After accepting the plan, compare available verified offers. Meal generation does not yet optimize your budget.")}</p>
      <button disabled={!meals.length || !stores.length} className="rounded-full bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? t("Saving...") : t("Create meal plan")}</button>
    </fieldset>
  </form>;
}
