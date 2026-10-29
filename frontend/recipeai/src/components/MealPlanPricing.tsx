import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/languageContext";
import { localDateInput, type MealPlan, type PlanStore } from "../lib/mealPlans";
import { quoteMealPlan, type PlanQuote } from "../lib/planPricing";

export default function MealPlanPricing({ plan, disabled }: { plan: MealPlan; disabled: boolean }) {
  const { t, locale } = useLanguage();
  const [shoppingDate, setShoppingDate] = useState(localDateInput);
  const [loyaltyStores, setLoyaltyStores] = useState<PlanStore[]>([]);
  const [quote, setQuote] = useState<PlanQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const request = useRef(0);
  const locked = disabled || loading;
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(value);
  const label = (store: string) => store === "LIDL" ? "Lidl" : store === "BIEDRONKA" ? "Biedronka" : t("Both stores");
  const today = localDateInput();
  const firstMeal = plan.plan.slots.filter(slot => slot.recipe && !slot.skipped).map(slot => slot.date).sort()[0];
  const week = new Date(); week.setDate(week.getDate() + 7);
  const weekDate = new Date(week.getTime() - week.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const lastDate = firstMeal && firstMeal < weekDate ? firstMeal : weekDate;

  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!quote) return;
    const remaining = Date.parse(quote.expiresAt) - Date.now();
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [quote]);

  const calculate = async () => {
    if (locked) return;
    const token = ++request.current;
    setLoading(true); setError(""); setQuote(null); setExpired(false);
    try {
      const result = await quoteMealPlan(plan, shoppingDate, loyaltyStores);
      if (token === request.current) setQuote(result);
    } catch {
      if (token === request.current) setError(t("Could not price this plan. Refresh the plan and check the shopping date."));
    } finally { if (token === request.current) setLoading(false); }
  };

  return <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-5 sm:p-6" aria-labelledby="plan-pricing-heading">
    <h2 id="plan-pricing-heading" className="text-2xl font-bold">{t("Compare shopping costs")}</h2>
    <p className="mt-2 text-sm text-primary/70">{t("We count whole packages using verified nationwide offers. Missing prices are never treated as zero. Travel costs are excluded.")}</p>
    <p className="mt-2 text-sm text-primary/70">{t("Automatic offer updates are not connected yet. Only offers checked by an administrator can be used.")}</p>
    <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); void calculate(); }}>
      <label className="block max-w-xs font-semibold">{t("Shopping date")}
        <input type="date" className="mt-2 w-full rounded-xl border border-primary/20 p-3" value={shoppingDate}
          min={today} max={lastDate} required disabled={locked} onChange={e => { setShoppingDate(e.target.value); setQuote(null); }} /></label>
      <p className="text-sm text-primary/60">{t("Choose a date within seven days, no later than your first meal.")}</p>
      <fieldset disabled={locked} className="space-y-2"><legend className="mb-2 font-semibold">{t("Loyalty discounts to include")}</legend>
        {plan.plan.settings.stores.map(store => <label key={store} className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={loyaltyStores.includes(store)} onChange={e => {
            setLoyaltyStores(e.target.checked ? [...loyaltyStores, store] : loyaltyStores.filter(s => s !== store)); setQuote(null);
          }} />{store === "LIDL" ? t("I can use Lidl Plus and activate the required coupon") : t("I can use Moja Biedronka and activate the required coupon")}
        </label>)}
      </fieldset>
      <button type="submit" disabled={locked || lastDate < today} className="rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40">{loading ? t("Checking prices...") : t("Compare prices")}</button>
    </form>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {expired && <p role="status" className="mt-4 text-amber-900">{t("This quote has expired. Compare prices again before shopping.")}</p>}
    {quote && !expired && <>
      <p className="mt-5 text-sm text-primary/60">{t("Calculated")}: {new Date(quote.calculatedAt).toLocaleString(locale)} · {t("Budget")}: {money(quote.budget)}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">{quote.baskets.map(basket => <article key={basket.option} className="min-w-0 rounded-2xl border border-primary/15 p-4">
        <h3 className="text-lg font-bold">{label(basket.option)}</h3>
        <p className="mt-2 text-2xl font-bold">{basket.pricedItems === 0 && basket.missingItems > 0 ? t("No verified prices") : money(basket.knownTotal)}</p>
        <p className="mt-1 text-sm">{t("{priced} priced, {missing} missing", { priced: basket.pricedItems, missing: basket.missingItems })}</p>
        <p className={`mt-3 font-semibold ${basket.budgetStatus === "WITHIN_BUDGET" ? "text-green-800" : "text-amber-900"}`}>
          {t(basket.budgetStatus === "WITHIN_BUDGET" ? "Estimated basket within budget" : basket.budgetStatus === "OVER_BUDGET" ? "Known costs exceed your budget" : "Incomplete quote — budget not confirmed")}</p>
        {basket.missingItems > 0 && basket.pricedItems > 0 && <p className="mt-2 text-sm">{t("This is the priced subtotal, not the full shopping cost.")}</p>}
        <ul className="mt-4 space-y-4">{basket.items.map(item => <li key={item.key} className="border-t border-primary/10 pt-3">
          <p className="font-semibold">{item.name}</p>
          {!item.offer ? <p className="text-sm text-amber-900">{t(item.missingReason === "CHECK_QUANTITY" ? "Check quantity before pricing" : "No eligible verified offer")}</p> : <>
            <p className="text-sm">{label(item.offer.details.store)} · {item.offer.details.productName}</p>
            <p className="mt-1">{item.packages} × {item.offer.details.packageAmount} {item.offer.details.unit} · {money(item.cost!)}</p>
            <p className="text-sm text-primary/70">{t("Left after these meals")}: {item.leftoverAmount} {item.offer.details.unit}</p>
            <p className="mt-2 text-sm">{item.offer.details.conditions}</p>
            <p className="text-sm">{item.offer.details.validFrom} – {item.offer.details.validTo}</p>
            <a className="text-sm underline" href={item.offer.details.sourceUrl} target="_blank" rel="noopener noreferrer">{t("Offer source")}</a>
          </>}
        </li>)}</ul>
      </article>)}</div>
      <p className="mt-4 text-sm text-primary/70">{t("Prices and stock may differ in store. Check offer conditions and product expiry dates. The estimate covers every item on this plan, including checked items.")}</p>
    </>}
  </section>;
}
