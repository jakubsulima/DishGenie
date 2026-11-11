import { captureEvent } from "../lib/posthog";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/languageContext";
import { type MealPlan, type PlanStore, selectPlanBasket } from "../lib/mealPlans";
import { planPricingDates } from "../lib/planPricingDates";
import { quoteMealPlan, type PlanQuote } from "../lib/planPricing";
import PlanPriceEntry from "./PlanPriceEntry";
import PlannerDisclosure from "./PlannerDisclosure";
import StorePriceSources from "./StorePriceSources";

export default function MealPlanPricing({ plan, disabled, auto = false, compact = false, onSelected }: { plan: MealPlan; disabled: boolean; auto?: boolean; compact?: boolean; onSelected?: (plan: MealPlan) => void }) {
  const { t, locale } = useLanguage();
  const dates = planPricingDates(plan);
  const [shoppingDate, setShoppingDate] = useState(() => {
    const saved = plan.plan.settings.shopping?.shoppingDate ?? "";
    return dates.allows(saved) ? saved : dates.today;
  });
  const validDate = dates.allows(shoppingDate);
  const [loyaltyStores, setLoyaltyStores] = useState<PlanStore[]>(plan.plan.settings.shopping?.loyaltyStores ?? []);
  const [quote, setQuote] = useState<PlanQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const request = useRef(0);
  const locked = disabled || loading;
  const validQuote = quote && quote.planId === plan.id && quote.planVersion === plan.version
    && quote.shoppingDate === shoppingDate && !expired && Date.parse(quote.expiresAt) > Date.now() ? quote : null;
  const summaryBasket = validQuote?.baskets.find(b => b.option === plan.plan.shopping?.basketOption) ?? validQuote?.baskets[0];
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(value);
  const label = (store: string) => store === "LIDL" ? "Lidl" : store === "BIEDRONKA" ? "Biedronka" : t("Both stores");

  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!quote) return;
    const remaining = Date.parse(quote.expiresAt) - Date.now();
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [quote]);

  useEffect(() => {
    if (!auto || disabled) return;
    if (!validDate) { request.current++; setLoading(false); setError(""); setQuote(null); return; }
    let ignore = false;
    const token = ++request.current;
    setLoading(true); setError(""); setQuote(null); setExpired(false);
    quoteMealPlan(plan, shoppingDate, loyaltyStores).then(result => { if (!ignore && token === request.current) { setQuote(result); captureEvent("meal_plan_quote_created", { planId: plan.id, planVersion: result.planVersion, basketCount: result.baskets.length }); } })
      .catch(() => { if (!ignore && token === request.current) setError(t("Could not price this plan. Refresh the plan and check the shopping date.")); })
      .finally(() => { if (!ignore && token === request.current) setLoading(false); });
    return () => { ignore = true; };
  }, [auto, disabled, plan, shoppingDate, validDate, loyaltyStores, t]);

  const calculate = async () => {
    if (locked || !validDate) return;
    const token = ++request.current;
    setLoading(true); setError(""); setQuote(null); setExpired(false);
    try {
      const result = await quoteMealPlan(plan, shoppingDate, loyaltyStores);
      if (token === request.current) { setQuote(result); captureEvent("meal_plan_quote_created", { planId: plan.id, planVersion: result.planVersion, basketCount: result.baskets.length }); }
    } catch {
      if (token === request.current) setError(t("Could not price this plan. Refresh the plan and check the shopping date."));
    } finally { if (token === request.current) setLoading(false); }
  };

  return <section className="mt-5 border-t border-primary/15 pt-4" aria-label={t("Compare shopping costs")}>
    {compact && <div className="mb-2 text-sm" aria-live="polite">
      {loading ? <p>{t("Checking prices...")}</p> : summaryBasket ? <>
        <p className="font-semibold">{label(summaryBasket.option)} · {summaryBasket.pricedItems === 0 && summaryBasket.missingItems > 0
          ? t("No verified prices") : `${t("Priced items")}: ${money(summaryBasket.knownTotal)}`} · {t("{count} without a price", { count: summaryBasket.missingItems })}</p>
        {summaryBasket.missingItems > 0 && <p className="mt-1 text-primary/70">{t("This is the priced subtotal, not the full shopping cost.")}</p>}
      </> : !error && !expired && <p>{t("Prices are not available yet.")}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {expired && <p className="text-amber-900">{t("This quote has expired. Compare prices again before shopping.")}</p>}
    </div>}
    <PlannerDisclosure title={t("Compare shopping costs")} defaultOpen={!compact}>
    <p className="mt-2 text-sm text-primary/70">{t("We count whole packages using available store prices and your prices. Loose produce is estimated by weight. Travel costs are excluded.")}</p>
    <p className="mt-2 text-sm text-primary/70">{t("Store prices and your own prices are shown separately. Missing prices are excluded from the total.")}</p>
    <StorePriceSources />
    <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); void calculate(); }}>
      <label className="block max-w-xs font-semibold">{t("Shopping date")}
        <input type="date" className="mt-2 w-full rounded-xl border border-primary/20 p-3" value={shoppingDate}
          min={dates.today} max={dates.latest} required disabled={locked} onChange={e => { setShoppingDate(e.target.value); setQuote(null); setError(""); }} /></label>
      <p className="text-sm text-primary/60">{t("Choose a date within seven days, no later than your next planned meal.")}</p>
      {!validDate && <p role="status" className="text-sm text-amber-900">{t("Choose a valid shopping date to check prices.")} <button type="button" className="underline" disabled={locked} onClick={() => setShoppingDate(dates.today)}>{t("Use today")}</button></p>}
      {plan.plan.slots.some(s => s.recipe && !s.skipped && s.date < dates.today) && <p className="text-sm text-primary/70">{t("Prices apply to the selected shopping date and all saved meals, including earlier days. Your plan dates stay unchanged.")}</p>}
      <fieldset disabled={locked} className="space-y-2"><legend className="mb-2 font-semibold">{t("Loyalty discounts to include")}</legend>
        {plan.plan.settings.stores.map(store => <label key={store} className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={loyaltyStores.includes(store)} onChange={e => {
            setLoyaltyStores(e.target.checked ? [...loyaltyStores, store] : loyaltyStores.filter(s => s !== store)); setQuote(null);
          }} />{store === "LIDL" ? t("I have Lidl Plus") : t("I have Moja Biedronka")}
        </label>)}
      </fieldset>
      <p className="text-sm">{t("A loyalty card does not activate coupons. Confirm each required coupon separately.")}</p>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={locked || !validDate} className="rounded-lg border border-primary/20 px-5 py-3 font-semibold disabled:opacity-40">{loading ? t("Checking prices...") : t("Compare prices")}</button>
        </div>
    </form>
    {!compact && error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {!compact && expired && <p role="status" className="mt-4 text-amber-900">{t("This quote has expired. Compare prices again before shopping.")}</p>}
    {validQuote && <>
      {validQuote.sources && validQuote.sources.length > 0 && <div className="mt-4 space-y-1 text-sm text-primary/70">{validQuote.sources.map(source => <p key={source.store}>
        {label(source.store)}: {t(source.status === "FEATURE_DISABLED" ? "Store promotions are currently available to administrators only."
          : source.status === "LIVE_LEAFLET_REVIEWED" ? "Prices imported from the complete Lidl leaflet; only reviewed meal ingredients are used."
          : source.status === "LIVE_LEAFLET_FETCH_FAILED" || source.status === "LIVE_LEAFLET_REVIEW_REQUIRED" ? "The leaflet could not be refreshed or needs review. Available saved prices are shown."
          : source.status === "LIVE_LEAFLET_EXPIRED" ? "The reviewed leaflet has expired. You can add your own prices."
          : source.status === "LIVE_PARTIAL" ? "Prices fetched from the official store website; partial coverage."
          : source.status === "LIVE_FETCH_INCOMPLETE" ? "Some store pages could not be refreshed. Available saved prices are shown."
          : source.status === "SOURCE_NOT_CONNECTED" || source.status === "LIVE_NOT_FETCHED" ? "No connected store prices. You can add your own prices."
          : source.status === "LIVE_NO_SUPPORTED_PRICES" ? "No supported current prices were found. You can add your own prices."
          : "Saved store prices are available.")}
        {source.fetchedAt && ` · ${new Date(source.fetchedAt).toLocaleString(locale)}`}
      </p>)}</div>}
      <p className="mt-5 text-sm text-primary/60">{t("Calculated")}: {new Date(validQuote.calculatedAt).toLocaleString(locale)} · {validQuote.budget == null ? t("No budget preference") : `${t("Budget")}: ${money(validQuote.budget)}`}</p>
      <div className={`mt-4 grid gap-4 ${validQuote.baskets.length === 1 ? "" : validQuote.baskets.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>{validQuote.baskets.map(basket => <article key={basket.option} className="min-w-0 rounded-2xl border border-primary/15 p-4">
        <h3 className="text-lg font-bold">{label(basket.option)}</h3>
        {onSelected && (plan.plan.shopping || plan.plan.schemaVersion >= 4) && <button className="mt-3 rounded-full border border-primary/20 px-3 py-2 text-sm disabled:opacity-40" disabled={locked} onClick={() => {
          setLoading(true); void selectPlanBasket(plan, basket.option, shoppingDate, loyaltyStores).then(onSelected)
            .catch(() => setError(t("Could not price this plan. Refresh the plan and check the shopping date."))).finally(() => setLoading(false));
        }}>{t("Use this basket for shopping")}</button>}
        <p className="mt-2 text-2xl font-bold">{basket.pricedItems === 0 && basket.missingItems > 0 ? t("No verified prices") : money(basket.knownTotal)}</p>
        <p className="mt-1 text-sm">{t("{priced} priced, {missing} missing", { priced: basket.pricedItems, missing: basket.missingItems })}</p>
        <p className={`mt-3 font-semibold ${basket.budgetStatus === "WITHIN_BUDGET" ? "text-green-800" : "text-amber-900"}`}>
          {t(basket.budgetStatus === "WITHIN_BUDGET" ? "Estimated basket within budget" : basket.budgetStatus === "OVER_BUDGET" ? "Known costs exceed your budget" : basket.budgetStatus === "NO_BUDGET" ? "Known shopping total" : validQuote.budget == null ? "Incomplete quote — missing prices" : "Incomplete quote — budget not confirmed")}</p>
        {basket.missingItems > 0 && basket.pricedItems > 0 && (!compact || basket.option !== summaryBasket?.option) && <p className="mt-2 text-sm">{t("This is the priced subtotal, not the full shopping cost.")}</p>}
        <PlannerDisclosure className="mt-4 border-t border-primary/10" title={t("Shopping details and conditions")}>
        <ul aria-label={t("Shopping details and conditions")} tabIndex={0} className="planner-scroll-list mt-2 space-y-4 rounded-lg px-1">{basket.items.map(item => <li key={item.key} className="border-t border-primary/10 pt-3">
          <p className="font-semibold">{item.name}</p>
          {item.manualPrice ? <><p className="text-sm">{t("Your price, private to this plan")} · {label(item.manualPrice.store)}</p>
            <p>{item.packages} × {item.manualPrice.packageAmount} {item.manualPrice.unit} · {money(item.cost!)}</p>
            <p className="text-sm text-primary/70">{t("Left after these meals")}: {item.leftoverAmount} {item.manualPrice.unit}</p></>
          : !item.offer ? <p className="text-sm text-amber-900">{t(item.missingReason === "CHECK_QUANTITY" ? "Check quantity before pricing" : "No eligible verified offer")}</p> : <>
            <p className="text-sm">{label(item.offer.details.store)} · {item.offer.details.productName}</p>
            {item.offer.sourceType === "LIDL_PUBLIC" && <p className="text-sm">{t("Price from the official store website")}</p>}
            <p className="mt-1">{item.offer.details.weighted ? `${item.purchasedAmount} ${item.offer.details.unit}` : `${item.packages} × ${item.offer.details.packageAmount} ${item.offer.details.unit}`} · {money(item.cost!)}</p>
            <p className="text-sm text-primary/70">{t("Left after these meals")}: {item.leftoverAmount} {item.offer.details.unit}</p>
            <p className="mt-2 text-sm">{item.offer.details.conditions}</p>
            <p className="text-sm">{item.offer.details.validFrom} – {item.offer.details.validTo}</p>
            <a className="text-sm underline" href={item.offer.details.sourceUrl} target="_blank" rel="noopener noreferrer">{t("Offer source")}</a>
          </>}
          {onSelected && <PlanPriceEntry plan={plan} item={item} stores={basket.stores} shoppingDate={shoppingDate} disabled={locked} onSaved={onSelected} />}
        </li>)}</ul></PlannerDisclosure>
      </article>)}</div>
      <p className="mt-4 text-sm text-primary/70">{t("Prices and stock may differ in store. Check offer conditions and product expiry dates. The estimate covers every item on this plan, including checked items.")}</p>
    </>}
    </PlannerDisclosure>
  </section>;
}
