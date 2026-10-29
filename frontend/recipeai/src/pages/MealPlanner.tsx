import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/languageContext";
import MealPlanPricing from "../components/MealPlanPricing";
import MealPlanForm from "../components/MealPlanForm";
import MealPlanSlotCard from "../components/MealPlanSlotCard";
import { acceptMealPlan, changePlanSlot, checkPlanShopping, createMealPlan, generatePlanSlot,
  getMealPlan, isSlotGenerating, listMealPlans, refreshPlanShopping,
  type MealPlan, type PlanSummary } from "../lib/mealPlans";
import { captureEvent } from "../lib/posthog";

export default function MealPlanner() {
  const { t, locale } = useLanguage();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("plan");
  const [summaries, setSummaries] = useState<PlanSummary[]>([]);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const working = useRef(false);
  const stop = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop.current = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(""); setPlan(null);
    Promise.all([listMealPlans(), selectedId ? getMealPlan(selectedId) : Promise.resolve(null)])
      .then(([list, current]) => { if (!ignore) {
        setSummaries(list); setPlan(current);
        captureEvent("planner_opened", { entryPoint: "navigation", isReturningUser: list.length > 0 });
      } })
      .catch(() => { if (!ignore) setError(t("Could not load meal plans. Please refresh and try again.")); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [selectedId, t]);

  const run = async (operation: () => Promise<MealPlan>) => {
    if (working.current) return;
    working.current = true; stop.current = false; setBusy(true); setError("");
    try {
      const updated = await operation();
      if (!mounted.current) return;
      setPlan(updated);
      if (selectedId !== updated.id) setParams({ plan: updated.id });
      const list = await listMealPlans();
      if (mounted.current) setSummaries(list);
    } catch (failure) {
      if (!mounted.current) return;
      const status = failure && typeof failure === "object" && "status" in failure ? failure.status : null;
      setError(status === 409 ? t("The plan changed or a meal is still generating. The latest saved version has been loaded.")
        : status === 429 ? t("Generation limit reached. Your saved meals are safe. Try again later.")
        : t("This action could not finish. Your saved meals are safe. Refresh the plan before retrying."));
      if (selectedId) {
        try { const current = await getMealPlan(selectedId); if (mounted.current) setPlan(current); }
        catch { /* Keep the last confirmed snapshot and visible error. */ }
      }
    } finally {
      working.current = false;
      if (mounted.current) { setBusy(false); setProgress(""); }
    }
  };

  const generateMissing = () => {
    if (!plan) return;
    void run(async () => {
      let current = plan;
      const pending = plan.plan.slots.filter(slot => !slot.recipe && !slot.skipped && !slot.locked);
      for (const [index, slot] of pending.entries()) {
        if (stop.current) break;
        setProgress(t("Generating meal {current} of {total}", { current: index + 1, total: pending.length }));
        current = await generatePlanSlot(current, slot.id, crypto.randomUUID());
        if (mounted.current) setPlan(current);
      }
      return current;
    });
  };
  const toggleShopping = (key: string, checked: boolean) => {
    if (!plan?.plan.shopping || working.current) return;
    const shopping = plan.plan.shopping;
    const checkedKeys = checked ? [...shopping.checkedKeys, key] : shopping.checkedKeys.filter(item => item !== key);
    setPlan({ ...plan, plan: { ...plan.plan, shopping: { ...shopping, checkedKeys } } });
    void run(async () => {
      try { return await checkPlanShopping(plan, key, checked); }
      catch (failure) { if (mounted.current) setPlan(plan); throw failure; }
    });
  };
  const remoteBusy = plan?.plan.slots.some(isSlotGenerating) ?? false;
  const disabled = busy || remoteBusy;
  const planned = plan?.plan.slots.filter(slot => slot.recipe && !slot.skipped).length ?? 0;
  const remaining = plan?.plan.slots.filter(slot => !slot.recipe && !slot.skipped).length ?? 0;
  const dates = [...new Set(plan?.plan.slots.map(slot => slot.date) ?? [])];
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
  const button = "rounded-full border border-primary/20 px-5 py-2.5 font-semibold hover:bg-primary/5 disabled:opacity-40";

  return <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 text-primary">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary/60">{t("Your week at the table")}</p>
        <h1 className="text-3xl font-bold sm:text-4xl">{t("Meal planner")}</h1>
        <p className="mt-3 max-w-2xl text-primary/70">{t("Plan lunches and dinners, keep the meals you like, and shop for what is missing.")}</p></div>
      <button className={button} disabled={busy} onClick={() => setParams({})}>{t("New plan")}</button>
    </div>
    {summaries.length > 0 && <label className="mb-6 block max-w-md">{t("Saved meal plans")}
      <select className="mt-2 w-full rounded-xl border border-primary/20 bg-white p-3" value={selectedId ?? ""} disabled={busy}
        onChange={e => setParams(e.target.value ? { plan: e.target.value } : {})}>
        <option value="">{t("New plan")}</option>
        {summaries.map(item => <option key={item.id} value={item.id}>{item.startDate} · {item.plannedSlots}/{item.totalSlots} · {t(item.status === "ACCEPTED" ? "Accepted" : "Draft")}</option>)}
      </select></label>}
    {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">{error}
      <button disabled={busy} className="ml-3 underline" onClick={() => selectedId ? void run(() => getMealPlan(selectedId)) : window.location.reload()}>{t("Refresh")}</button></div>}
    {loading ? <p role="status">{t("Loading meal plans...")}</p> : !selectedId ? <MealPlanForm busy={busy} onCreate={settings => void run(() => createMealPlan(settings))} /> : plan ? <>
      <section className="mb-6 rounded-3xl border border-primary/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm">{t(plan.plan.status === "ACCEPTED" ? "Accepted" : "Draft")}</span>
            <p className="mt-3 font-semibold">{t("{count} meals planned", { count: planned })}</p></div>
          <div className="text-right"><p className="font-semibold">{t("Budget")}: {new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(plan.plan.settings.budget)}</p>
            <p className="text-sm text-primary/70">{plan.plan.settings.stores.map(store => store === "LIDL" ? "Lidl" : "Biedronka").join(" · ")}</p></div>
        </div>
        <p className="my-4 text-sm text-amber-900">{t(plan.plan.status === "ACCEPTED" ? "Compare available prices below. Generating meals does not guarantee the budget." : "Accept your plan to compare available prices. Generating meals does not guarantee the budget.")}</p>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40" disabled={disabled || remaining === 0} onClick={generateMissing}>{t("Generate missing meals")}</button>
          <button className={button} disabled={disabled || planned === 0 || plan.plan.status === "ACCEPTED"} onClick={() => void run(async () => {
            const started = performance.now();
            const accepted = await acceptMealPlan(plan);
            captureEvent("meal_plan_accepted", { planId: accepted.id, fullSlotCount: planned, emptySlotCount: remaining, durationMs: Math.round(performance.now() - started) });
            captureEvent("meal_plan_shopping_list_created", { planId: accepted.id, planVersion: accepted.version, itemCount: accepted.plan.shopping?.items.length ?? 0 });
            return accepted;
          })}>{t("Accept plan and create shopping list")}</button>
          <button className={button} disabled={busy} onClick={() => void run(() => getMealPlan(plan.id))}>{t("Refresh")}</button>
          {busy && progress && <button className={button} onClick={() => { stop.current = true; }}>{t("Stop after this meal")}</button>}
        </div>
        <p className="mt-3 text-sm text-primary/60">{t("Each generated meal uses one recipe request. Earlier meals are saved if you stop or leave this page.")}</p>
        {remaining > 0 && <p className="mt-2 text-sm text-primary/60">{t("You can accept a partial plan. Empty and skipped meals are excluded from shopping.")}</p>}
        {(progress || remoteBusy) && <p role="status" className="mt-3 font-semibold">{progress || t("Generating this meal. Refresh to check progress.")}</p>}
      </section>
      <div className="space-y-5">{dates.map(date => <section key={date} aria-label={dateLabel(date)}>
        <h2 className="mb-3 text-lg font-semibold capitalize">{dateLabel(date)}</h2>
        <div className="grid gap-4 md:grid-cols-2">{plan.plan.slots.filter(slot => slot.date === date).map(slot => <MealPlanSlotCard key={slot.id} slot={slot} busy={disabled}
          onGenerate={() => void run(() => generatePlanSlot(plan, slot.id, crypto.randomUUID()))}
          onChange={(action, servings) => void run(() => changePlanSlot(plan, slot.id, action, servings))} />)}</div>
      </section>)}</div>
      {plan.plan.shopping && <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">{t("Shopping for this plan")}</h2>
          <button disabled={disabled} className={button} onClick={() => void run(() => refreshPlanShopping(plan))}>{t("Recalculate from fridge")}</button></div>
        <p className="mt-2 text-sm text-primary/70">{t("This checklist belongs to this plan. Your manual shopping list is unchanged.")}</p>
        <p className="mt-2 text-sm text-primary/60">{t("Calculated")}: {new Date(plan.plan.shopping.calculatedAt).toLocaleString(locale)}</p>
        <ul className="mt-5 divide-y divide-primary/10">{plan.plan.shopping.items.map(item => <li key={item.key} className="flex items-start gap-3 py-3">
          {item.amount !== 0 && <input className="mt-1 h-5 w-5" type="checkbox" aria-label={item.name} checked={plan.plan.shopping!.checkedKeys.includes(item.key)} disabled={disabled}
            onChange={e => toggleShopping(item.key, e.target.checked)} />}
          <div><span className="font-semibold">{item.name}</span> · {item.amount === null ? t("Check quantity") : item.amount === 0 ? t("Available in fridge") : `${item.amount} ${item.unit}`}
            {item.usedFromFridge > 0 && <p className="text-sm text-primary/60">{t("From fridge")}: {item.usedFromFridge} {item.unit}</p>}
            {item.needsReview && <p className="text-sm text-amber-900">{t("Check the amount and unit at home before shopping.")}</p>}
            <p className="text-sm text-primary/60">{item.slotIds.map(id => { const slot = plan.plan.slots.find(s => s.id === id); return slot ? `${dateLabel(slot.date)} · ${t(slot.mealType === "LUNCH" ? "Lunch" : "Dinner")}` : ""; }).join(", ")}</p>
          </div>
        </li>)}</ul>
      </section>}
      {plan.plan.shopping && <MealPlanPricing key={`${plan.id}:${plan.plan.shopping.calculatedAt}`} plan={plan} disabled={disabled} />}
    </> : null}
  </div>;
}
