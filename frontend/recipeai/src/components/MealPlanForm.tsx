import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFridge } from "../context/fridgeContext";
import { useUser } from "../context/context";
import type { WeekException } from "../lib/weekCycle";
import { durableIntent, readyPortions, type ReadyPortions } from "../lib/weekCycle";
import DealSelection from "./DealSelection";
import { useLanguage } from "../context/languageContext";
import { getShoppingPreferences, localDateInput, type PlanSettings, type MealType, type PlanStore } from "../lib/mealPlans";

export default function MealPlanForm({ busy, onCreate, initialSettings, onDraftChange, startDateHint }: {
  startDateHint?: string; initialSettings?: PlanSettings; onDraftChange?: (dirty: boolean) => void; busy: boolean; onCreate: (settings: PlanSettings) => void;
}) {
  const { t, locale } = useLanguage();
  const advanced = useRef<HTMLDetailsElement>(null);
  const { user } = useUser();
  const { fridgeItems, updateFridgeItem, removeFridgeItem } = useFridge();
  const [exceptionDate, setExceptionDate] = useState<string | null>(null);
  const [weekExceptions, setWeekExceptions] = useState<WeekException[]>([]);
  const [priorityFridgeIds, setPriorityFridgeIds] = useState<number[]>([]);
  const [planningMode, setPlanningMode] = useState<"PRACTICAL" | "PROMOTIONS_FIRST">(() => localStorage.getItem("recipeai-offers-ready") ? "PROMOTIONS_FIRST" : "PRACTICAL");
  const [reviewSaving,setReviewSaving]=useState(0);
  const [reviewError, setReviewError] = useState("");
  const [ready,setReady] = useState<ReadyPortions[]>([]);
  useEffect(()=>{ let ignore=false; void readyPortions().then(value=>{if(!ignore)setReady(value);}).catch(()=>{});return()=>{ignore=true;}; },[]);
  const offerDate = localStorage.getItem("recipeai-offers-ready");
  const defaultDate = offerDate && /^\d{4}-\d{2}-\d{2}$/.test(offerDate) && offerDate >= localDateInput() ? offerDate : localDateInput();
  const [startDate, setStartDate] = useState(() => startDateHint ?? defaultDate);
  const [dayCount, setDayCount] = useState(7);
  const [servings, setServings] = useState(2);
  const [budget, setBudget] = useState("");
  const [maxMinutes, setMaxMinutes] = useState(45);
  const [meals, setMeals] = useState<MealType[]>(["LUNCH", "DINNER"]);
  const [stores, setStores] = useState<PlanStore[]>(["LIDL"]);
  const [shoppingDate, setShoppingDate] = useState(() => defaultDate);
  const [maxStores, setMaxStores] = useState(1);
  const [loyaltyStores, setLoyaltyStores] = useState<PlanStore[]>([]);
  const [confirmedCouponOffers, setConfirmedCouponOffers] = useState<string[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [allowRepeats, setAllowRepeats] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  useEffect(() => {
    let ignore = false;
    (initialSettings ? Promise.resolve(initialSettings) : getShoppingPreferences()).then(preferences => {
      const pending = !initialSettings && localStorage.getItem(`recipeai-cycle-intent:form:${user?.id ?? "current"}`);
      const saved: PlanSettings | null = pending ? JSON.parse(pending).body : preferences;
      if (pending && saved) { setStartDate(saved.startDate); setWeekExceptions(saved.weekExceptions ?? []); setPriorityFridgeIds(saved.priorityFridgeIds ?? []); }
      if ((initialSettings || pending || saved?.cyclePreferences) && saved?.planningMode === "PROMOTIONS_FIRST") setPlanningMode("PROMOTIONS_FIRST");
      if (ignore || !saved) return;
      if (initialSettings) { setStartDate(saved.startDate); setShoppingDate(saved.shopping?.shoppingDate ?? (saved.startDate < localDateInput() ? "" : localDateInput())); setSelectedOffers(saved.shopping?.selectedOffers ?? []); setConfirmedCouponOffers(saved.shopping?.confirmedCouponOffers ?? []); }
      setDayCount(saved.dayCount); setServings(saved.servings); setBudget(saved.budget == null ? "" : String(saved.budget));
      setMaxMinutes(saved.maxMinutes); setMeals(saved.mealTypes); setStores(saved.stores);
      setMaxStores(saved.shopping?.maxStores ?? 1); setLoyaltyStores(saved.shopping?.loyaltyStores ?? []); setAllowRepeats(saved.shopping?.allowRepeats ?? false);
    }).catch(() => { /* Defaults remain usable when preferences cannot be loaded. */ }).finally(() => { if (!ignore) setPreferencesLoading(false); });
    return () => { ignore = true; };
  }, [initialSettings, user?.id]);
  const clearOffers = () => { setSelectedOffers([]); setConfirmedCouponOffers([]); };
  const today = localDateInput();
  const nextWeek = localDateInput(7);
  const latestShoppingDate = planningMode === "PRACTICAL" ? startDate : startDate < nextWeek ? startDate : nextWeek;
  const historicalShopping = Boolean(initialSettings && (initialSettings.startDate < today
    || initialSettings.shopping?.shoppingDate && initialSettings.shopping.shoppingDate < today));
  const inputClass = "mt-1 w-full rounded-lg border border-primary/20 bg-white p-3 text-primary";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = { startDate, dayCount, servings, budget: budget === "" ? null : Number(budget), maxMinutes, mealTypes: meals, stores, locale: initialSettings?.locale ?? "pl" as const,
      planningMode, budgetMode: budget === "" ? "NONE" as const : "SOFT" as const,
      weekExceptions: weekExceptions.filter(e => e.date >= startDate && e.date < localDateAfter(startDate, dayCount) && meals.includes(e.mealType)), priorityFridgeIds,
      shopping: { shoppingDate: shoppingDate || null, maxStores, loyaltyStores, confirmedCouponOffers, selectedOffers, allowRepeats } };
    const intent = initialSettings ? { body: fields, requestId: initialSettings.requestId } : durableIntent(`form:${user?.id ?? "current"}`, fields);
    onCreate({ ...intent.body, requestId: intent.requestId });
  };
  return <form onChange={() => onDraftChange?.(true)} onSubmit={submit} onInvalidCapture={() => { if (advanced.current) advanced.current.open = true; }} className="rounded-xl bg-white p-4 sm:p-6">
    <fieldset disabled={busy || preferencesLoading || reviewSaving>0} className="min-w-0 space-y-5 disabled:opacity-60">
      <legend className="mb-4 text-xl font-semibold">{t(initialSettings ? "Planner settings" : "New plan")}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label>{t("Start date")}<input type="date" disabled={Boolean(initialSettings)} required min={today} value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} /></label>
        <label>{t("Number of days")}<input type="number" disabled={Boolean(initialSettings)} required min={1} max={7} value={dayCount} onChange={e => setDayCount(Number(e.target.value))} className={inputClass} /></label>
        <label>{t("People")}<input type="number" disabled={Boolean(initialSettings)} required min={1} max={100} value={servings} onChange={e => setServings(Number(e.target.value))} className={inputClass} /></label>
      </div>
      <fieldset><legend className="mb-2 font-semibold">{t("Meals to plan")}</legend>
        <div className="flex flex-wrap gap-6">{(["BREAKFAST", "LUNCH", "DINNER"] as const).map(meal => <label key={meal} className="flex items-center gap-2">
          <input type="checkbox" disabled={Boolean(initialSettings)} checked={meals.includes(meal)} onChange={e => setMeals(current => e.target.checked ? [...current, meal] : current.filter(m => m !== meal))} />
          {t(meal === "BREAKFAST" ? "Breakfast" : meal === "LUNCH" ? "Lunch" : "Dinner")}
        </label>)}</div>
      </fieldset>
      <p className="text-sm text-primary/75">{stores.map(store => store === "LIDL" ? "Lidl" : "Biedronka").join(" · ") || t("Preferred stores")} · {t("Shopping date")}: {shoppingDate ? new Date(`${shoppingDate}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" }) : t("Choose a date")}</p>
      <details ref={advanced} className="border-y border-primary/10 py-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("Customize")}</summary>
        <div className="space-y-5 pt-3">
      {!initialSettings && <>
        {ready.length>0 && <details><summary className="min-h-11 cursor-pointer py-2">{t("Remaining prepared portions")}</summary>{ready.map(b=><p className="break-words py-2" key={`${b.planId}:${b.batchId}`}>{b.name} · {b.remaining} {t("servings")} · {t("Check storage before eating")}</p>)}</details>}
        <details className="border-t border-primary/10 py-2"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("Exceptions this week")}</summary>
          <p className="mb-2 text-sm text-primary/65">{t("Choose a day to adjust its meals.")}</p>
          <div className="flex flex-wrap gap-2">{Array.from({length:dayCount},(_,n)=>localDateAfter(startDate,n)).map(date=><button type="button" key={date} aria-pressed={exceptionDate===date} onClick={()=>setExceptionDate(current=>current===date?null:date)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${exceptionDate===date?'bg-primary text-white':'border-primary/20'}`}>
            {new Date(`${date}T12:00:00`).toLocaleDateString(locale,{weekday:'short',day:'numeric'})}{weekExceptions.some(e=>e.date===date&&(e.skipped||e.cookForNext||e.maxMinutes))?' •':''}
          </button>)}</div>
          {Array.from({length: dayCount}, (_, n) => localDateAfter(startDate, n)).filter(date=>date===exceptionDate).flatMap(date => meals.map(mealType => {
            const current = weekExceptions.find(e => e.date === date && e.mealType === mealType);
            const update = (patch: Partial<WeekException>) => setWeekExceptions(all => [...all.filter(e => e.date !== date || e.mealType !== mealType), {date, mealType, skipped: false, maxMinutes: null, ...current, ...patch}]);
            return <div className="my-3 grid gap-2 sm:grid-cols-2" key={`${date}:${mealType}`}>
              <label className="flex items-center gap-2"><input type="checkbox" checked={current?.skipped ?? false} onChange={e => update({skipped:e.target.checked})}/>{date} · {t(mealType === "BREAKFAST" ? "Breakfast" : mealType === "LUNCH" ? "Lunch" : "Dinner")} · {t("Away from home")}</label>
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={current?.skipped} checked={current?.cookForNext ?? false} onChange={e=>update({cookForNext:e.target.checked})}/>{t("Cook for the next meal too")}</label>
              <label>{t("Time limit for this meal")}<input className={inputClass} type="number" min={5} max={240} value={current?.maxMinutes ?? ""} onChange={e => update({maxMinutes:e.target.value ? Number(e.target.value) : null})}/></label>
            </div>;
          }))}
        </details>
        <details className="border-t border-primary/10 py-2"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("Use this week (optional)")}</summary>
          <p className="text-sm">{t("Unknown quantities need checking. You can skip this review.")}</p>
          {reviewError && <p role="alert">{reviewError}</p>}
          {[...fridgeItems].sort((a,b)=>expiryOrder(a.expirationDate).localeCompare(expiryOrder(b.expirationDate))).map(item => <div key={item.id} className="my-3 flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={priorityFridgeIds.includes(item.id)} onChange={e => setPriorityFridgeIds(ids => e.target.checked ? [...ids,item.id] : ids.filter(id=>id!==item.id))}/><span className="break-words">{item.name} · {item.amount ?? t("Check at home")} {item.unit} {item.expirationDate}</span></label>
            <label>{t("Correct amount")}<input aria-label={`${t("Amount")} ${item.name}`} type="number" min={0} step="any" defaultValue={item.amount ?? ""} className="ml-2 w-24 rounded border p-2" onBlur={e => {
              if(e.target.value === String(item.amount ?? "")) return;
              setReviewSaving(n=>n+1);
              void updateFridgeItem(item.id,{name:item.name,amount:e.target.value,unit:item.unit,expirationDate:item.expirationDate}).catch(()=>setReviewError(t("Could not save. Retry after reconnecting."))).finally(()=>setReviewSaving(n=>n-1));
            }}/></label>
            <button type="button" className="min-h-11 px-2 underline" onClick={()=>void removeFridgeItem(item.id).then(()=>setPriorityFridgeIds(ids=>ids.filter(id=>id!==item.id))).catch(()=>setReviewError(t("Could not save. Retry after reconnecting.")))}>{t("No longer available")}</button>
          </div>)}
          {!fridgeItems.length && <p>{t("Your fridge is empty.")}</p>}
        </details>
      </>}
        <label>{t("Planning style")}<select className={inputClass} value={planningMode} onChange={e => { setPlanningMode(e.target.value as "PRACTICAL"|"PROMOTIONS_FIRST"); clearOffers(); }}><option value="PRACTICAL">{t("Practical week — prices optional")}</option><option value="PROMOTIONS_FIRST">{t("Plan from promotions")}</option></select></label>
        <label>{t("Maximum minutes per meal")}<input type="number" required min={5} max={240} value={maxMinutes} onChange={e => setMaxMinutes(Number(e.target.value))} className={inputClass} /></label>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><label htmlFor="plan-budget">{t("Budget for this plan (PLN)")}</label>
          <input id="plan-budget" aria-describedby="plan-budget-help" type="number" min="0.01" max="100000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} className={inputClass} />
          <p id="plan-budget-help" className="mt-2 text-sm text-primary/70">{t("For the selected meals and days, not all household groceries.")}</p>
        </div>
        <fieldset><legend className="mb-2 font-semibold">{t("Preferred stores")}</legend>
          <div className="flex flex-wrap gap-6">{(["LIDL", "BIEDRONKA"] as const).map(store => <label key={store} className="flex items-center gap-2">
            <input type="checkbox" checked={stores.includes(store)} onChange={e => { setStores(current => e.target.checked ? [...current, store] : current.filter(s => s !== store)); clearOffers(); }} />
            {store === "LIDL" ? "Lidl" : "Biedronka"}
          </label>)}</div>
        </fieldset>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label>{t("Shopping date")}<input type="date" disabled={historicalShopping} required min={today} max={latestShoppingDate} aria-describedby={historicalShopping ? undefined : "plan-shopping-date-help"} value={shoppingDate} onChange={e => { setShoppingDate(e.target.value); clearOffers(); }} className={inputClass} /></label>
          {!historicalShopping && <p id="plan-shopping-date-help" className="mt-2 text-sm text-primary/70">{t("Choose a date within seven days, no later than your first meal.")}</p>}</div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={maxStores === 2} onChange={e => setMaxStores(e.target.checked ? 2 : 1)} />{t("Allow shopping in two stores")}</label>
      </div>
      <p className="text-sm">{t("Two selected chains compare single-store options. Splitting shopping requires your separate choice.")}</p>
      <fieldset><legend className="mb-2 font-semibold">{t("My loyalty cards")}</legend>
        {stores.map(store => <label className="mr-5 inline-flex items-center gap-2" key={store}><input type="checkbox" checked={loyaltyStores.includes(store)} onChange={e => { setLoyaltyStores(e.target.checked ? [...loyaltyStores, store] : loyaltyStores.filter(s => s !== store)); if (!e.target.checked) clearOffers(); }} />{store === "LIDL" ? "Lidl Plus" : "Moja Biedronka"}</label>)}
        <p className="mt-2 text-sm">{t("A loyalty card does not activate coupons. Confirm each required coupon separately.")}</p>
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" checked={allowRepeats} onChange={e => setAllowRepeats(e.target.checked)} />{t("Allow repeated meals")}</label>
      <DealSelection stores={stores} shoppingDate={shoppingDate} loyaltyStores={loyaltyStores} selected={selectedOffers} confirmed={confirmedCouponOffers} onSelected={setSelectedOffers} onConfirmed={setConfirmedCouponOffers} />
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{t("Budget is optional and never blocks your plan. We remember these settings on your account.")}</p>
        </div>
      </details>
      <button disabled={!meals.length || !stores.length} className="rounded-lg bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? t("Saving...") : t(initialSettings ? "Save planner settings" : "Plan the week")}</button>
    </fieldset>
  </form>;
}

function localDateAfter(date: string, days: number) { const day = new Date(`${date}T12:00:00`); day.setDate(day.getDate()+days); return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`; }

function expiryOrder(date: string | null) { return date ? (/^\d{4}-/.test(date) ? date : date.split("-").reverse().join("-")) : "9999"; }
