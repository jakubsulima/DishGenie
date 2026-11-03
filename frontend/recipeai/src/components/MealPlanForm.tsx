import { useEffect, useRef, useState, type FormEvent } from "react";
import DealSelection from "./DealSelection";
import { useLanguage } from "../context/languageContext";
import { getShoppingPreferences, localDateInput, type PlanSettings, type MealType, type PlanStore } from "../lib/mealPlans";

export default function MealPlanForm({ busy, onCreate, initialSettings }: {
  initialSettings?: PlanSettings; busy: boolean; onCreate: (settings: PlanSettings) => void;
}) {
  const { t, locale } = useLanguage();
  const request = useRef({ signature: "", id: "" });
  const [startDate, setStartDate] = useState(localDateInput);
  const [dayCount, setDayCount] = useState(7);
  const [servings, setServings] = useState(2);
  const [budget, setBudget] = useState("");
  const [maxMinutes, setMaxMinutes] = useState(45);
  const [meals, setMeals] = useState<MealType[]>(["LUNCH", "DINNER"]);
  const [stores, setStores] = useState<PlanStore[]>(["LIDL"]);
  const [shoppingDate, setShoppingDate] = useState(localDateInput);
  const [maxStores, setMaxStores] = useState(1);
  const [loyaltyStores, setLoyaltyStores] = useState<PlanStore[]>([]);
  const [confirmedCouponOffers, setConfirmedCouponOffers] = useState<string[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [allowRepeats, setAllowRepeats] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  useEffect(() => {
    let ignore = false;
    (initialSettings ? Promise.resolve(initialSettings) : getShoppingPreferences()).then(saved => {
      if (ignore || !saved) return;
      if (initialSettings) { setStartDate(saved.startDate); setShoppingDate(saved.shopping?.shoppingDate ?? localDateInput()); setSelectedOffers(saved.shopping?.selectedOffers ?? []); setConfirmedCouponOffers(saved.shopping?.confirmedCouponOffers ?? []); }
      setDayCount(saved.dayCount); setServings(saved.servings); setBudget(saved.budget == null ? "" : String(saved.budget));
      setMaxMinutes(saved.maxMinutes); setMeals(saved.mealTypes); setStores(saved.stores);
      setMaxStores(saved.shopping?.maxStores ?? 1); setLoyaltyStores(saved.shopping?.loyaltyStores ?? []); setAllowRepeats(saved.shopping?.allowRepeats ?? false);
    }).catch(() => { /* Defaults remain usable when preferences cannot be loaded. */ }).finally(() => { if (!ignore) setPreferencesLoading(false); });
    return () => { ignore = true; };
  }, [initialSettings]);
  const clearOffers = () => { setSelectedOffers([]); setConfirmedCouponOffers([]); };
  const inputClass = "mt-1 w-full rounded-xl border border-primary/20 bg-white p-3 text-primary";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = { startDate, dayCount, servings, budget: budget === "" ? null : Number(budget), maxMinutes, mealTypes: meals, stores, locale: initialSettings?.locale ?? locale,
      planningMode: "DEALS" as const, budgetMode: budget === "" ? "NONE" as const : "SOFT" as const,
      shopping: { shoppingDate, maxStores, loyaltyStores, confirmedCouponOffers, selectedOffers, allowRepeats } };
    const signature = JSON.stringify(fields);
    if (request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    onCreate({ ...fields, requestId: request.current.id });
  };
  return <form onSubmit={submit} className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm sm:p-8">
    <fieldset disabled={busy || preferencesLoading} className="space-y-6 disabled:opacity-60">
      <legend className="mb-4 text-xl font-semibold">{t("Plan your lunches and dinners")}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>{t("Start date")}<input type="date" disabled={Boolean(initialSettings)} required value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} /></label>
        <label>{t("Number of days")}<input type="number" disabled={Boolean(initialSettings)} required min={1} max={7} value={dayCount} onChange={e => setDayCount(Number(e.target.value))} className={inputClass} /></label>
        <label>{t("People")}<input type="number" disabled={Boolean(initialSettings)} required min={1} max={100} value={servings} onChange={e => setServings(Number(e.target.value))} className={inputClass} /></label>
        <label>{t("Maximum minutes per meal")}<input type="number" required min={5} max={240} value={maxMinutes} onChange={e => setMaxMinutes(Number(e.target.value))} className={inputClass} /></label>
      </div>
      <fieldset><legend className="mb-2 font-semibold">{t("Meals to plan")}</legend>
        <div className="flex gap-6">{(["LUNCH", "DINNER"] as const).map(meal => <label key={meal} className="flex items-center gap-2">
          <input type="checkbox" disabled={Boolean(initialSettings)} checked={meals.includes(meal)} onChange={e => setMeals(current => e.target.checked ? [...current, meal] : current.filter(m => m !== meal))} />
          {t(meal === "LUNCH" ? "Lunch" : "Dinner")}
        </label>)}</div>
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><label htmlFor="plan-budget">{t("Budget for this plan (PLN)")}</label>
          <input id="plan-budget" aria-describedby="plan-budget-help" type="number" min="0.01" max="100000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} className={inputClass} />
          <p id="plan-budget-help" className="mt-2 text-sm text-primary/70">{t("For the selected meals and days, not all household groceries.")}</p>
        </div>
        <fieldset><legend className="mb-2 font-semibold">{t("Preferred stores")}</legend>
          <div className="flex gap-6">{(["LIDL", "BIEDRONKA"] as const).map(store => <label key={store} className="flex items-center gap-2">
            <input type="checkbox" checked={stores.includes(store)} onChange={e => { setStores(current => e.target.checked ? [...current, store] : current.filter(s => s !== store)); clearOffers(); }} />
            {store === "LIDL" ? "Lidl" : "Biedronka"}
          </label>)}</div>
        </fieldset>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>{t("Shopping date")}<input type="date" required min={localDateInput()} max={startDate} value={shoppingDate} onChange={e => { setShoppingDate(e.target.value); clearOffers(); }} className={inputClass} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={maxStores === 2} onChange={e => setMaxStores(e.target.checked ? 2 : 1)} />{t("Allow shopping in two stores")}</label>
      </div>
      <p className="text-sm">{t("Two selected chains compare single-store options. Splitting shopping requires your separate choice.")}</p>
      <fieldset><legend className="mb-2 font-semibold">{t("My loyalty cards")}</legend>
        {stores.map(store => <label className="mr-5 inline-flex items-center gap-2" key={store}><input type="checkbox" checked={loyaltyStores.includes(store)} onChange={e => { setLoyaltyStores(e.target.checked ? [...loyaltyStores, store] : loyaltyStores.filter(s => s !== store)); setConfirmedCouponOffers([]); }} />{store === "LIDL" ? "Lidl Plus" : "Moja Biedronka"}</label>)}
        <p className="mt-2 text-sm">{t("A loyalty card does not activate coupons. Confirm each required coupon separately.")}</p>
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" checked={allowRepeats} onChange={e => setAllowRepeats(e.target.checked)} />{t("Allow repeated meals")}</label>
      <DealSelection stores={stores} shoppingDate={shoppingDate} loyaltyStores={loyaltyStores} selected={selectedOffers} confirmed={confirmedCouponOffers} onSelected={setSelectedOffers} onConfirmed={setConfirmedCouponOffers} />
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{t("Budget is optional and never blocks your plan. We remember these settings on your account.")}</p>
      <button disabled={!meals.length || !stores.length} className="rounded-full bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? t("Saving...") : t(initialSettings ? "Save planner settings" : "Create meal plan")}</button>
    </fieldset>
  </form>;
}
