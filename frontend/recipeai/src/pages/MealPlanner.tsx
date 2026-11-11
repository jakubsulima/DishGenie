import WeekCycleWorkspace from "../components/WeekCycleWorkspace";
import { startCycle, clearIntent } from "../lib/weekCycle";
import { useUser } from "../context/context";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/languageContext";
import PlanShoppingGroups from "../components/PlanShoppingGroups";
import MealPlanPricing from "../components/MealPlanPricing";
import MealPlanForm from "../components/MealPlanForm";
import MealPlanSlotCard from "../components/MealPlanSlotCard";
import PlannerDialog from "../components/PlannerDialog";
import PlannerMenu from "../components/PlannerMenu";
import PlannerDisclosure from "../components/PlannerDisclosure";
import MealPlanOffers from "../components/MealPlanOffers";
import { useOffersAccess } from "../context/offersAccessContext";
import { acceptMealPlan, changePlanSlot, checkPlanShopping, generatePlanSlot,
  getMealPlan, isSlotGenerating, listMealPlans, preferredMealPlan, refreshPlanShopping,
  updatePlanSettings, startWeekGeneration, replanFromOffers, getWeekGeneration, cancelWeekGeneration, type GenerationProgress,
  type MealPlan, type PlanSummary } from "../lib/mealPlans";
import { captureEvent } from "../lib/posthog";

export default function MealPlanner() {
  const offersAvailable = useOffersAccess();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const translations = useRef(t); translations.current = t;
  const [params, setParams] = useSearchParams();
  const paramsSetter = useRef(setParams); paramsSetter.current = setParams;
  const selectedId = params.get("plan");
  const [summaries, setSummaries] = useState<PlanSummary[]>([]);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const creatingNew = !selectedId && params.get("new") === "1";
  const view = params.get("view") === "shopping" ? "shopping" : "meals";
  const [editingSettings, setEditingSettings] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState<MealPlan | null>(null);
  const [shoppingVisited, setShoppingVisited] = useState(view === "shopping");
  const [offersOpen, setOffersOpen] = useState(false);
  const drafts = useRef(new Set<string>());
  const [revisionBusy, setRevisionBusy] = useState<Set<string>>(new Set());
  const draftChanged = useCallback((id: string, dirty: boolean) => {
    if (dirty) drafts.current.add(id); else drafts.current.delete(id);
  }, []);
  const settingsDraftChanged = useCallback((dirty: boolean) => draftChanged("settings", dirty), [draftChanged]);
  const revisionBusyChanged = useCallback((id: string, busy: boolean) => {
    setRevisionBusy(previous => {
      if (previous.has(id) === busy) return previous;
      const next = new Set(previous); if (busy) next.add(id); else next.delete(id); return next;
    });
  }, []);
  const operationEpoch = useRef(0);
  const slotRequests = useRef(new Map<string, { version: number; id: string }>());
  const route = useRef(selectedId);
  route.current = selectedId;
  const applySaved = useCallback((saved: MealPlan) => {
    if (route.current !== saved.id) return;
    setPlan(current => current?.id === saved.id && current.version > saved.version ? current : saved);
  }, []);
  const navigatePlan = (next: Record<string, string>) => {
    if (busy || revisionBusy.size) return;
    if (drafts.current.size && !window.confirm(t("Discard unfinished changes?"))) return;
    drafts.current.clear(); setParams(next); setHistoryOpen(false);
  };
  const blocker = useBlocker(({ currentLocation, nextLocation }) => drafts.current.size > 0 && (
    currentLocation.pathname !== nextLocation.pathname || new URLSearchParams(currentLocation.search).get("plan") !== new URLSearchParams(nextLocation.search).get("plan")
    || new URLSearchParams(currentLocation.search).get("new") !== new URLSearchParams(nextLocation.search).get("new")));
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm(t("Discard unfinished changes?"))) { drafts.current.clear(); blocker.proceed(); }
    else blocker.reset();
  }, [blocker, t]);
  const showShopping = () => {
    setShoppingVisited(true);
    setParams(current => { const next = new URLSearchParams(current); next.set("view", "shopping"); return next; });
  };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (drafts.current.size) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const [job, setJob] = useState<GenerationProgress | null>(null);
  const jobRequest = useRef({ planId: "", version: -1, id: "" });
  const replanRequest = useRef({ planId: "", version: -1, id: "" });
  const [error, setError] = useState("");
  const working = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(""); setPlan(null); setEditingSettings(false); setSettingsSnapshot(null); setOffersOpen(false); setRevisionBusy(new Set());
    Promise.all([listMealPlans(), selectedId ? getMealPlan(selectedId) : Promise.resolve(null)])
      .then(([list, current]) => { if (!ignore) {
        setSummaries(list);
        if (!selectedId && !creatingNew) {
          const preferred = preferredMealPlan(list);
          if (preferred) { paramsSetter.current({ plan: preferred.id }, { replace: true }); return; }
        }
        setPlan(previous => previous?.id === current?.id && previous && current && previous.version > current.version ? previous : current);
        captureEvent("planner_opened", { entryPoint: "navigation", isReturningUser: list.length > 0 });
      } })
      .catch(() => { if (!ignore) setError(translations.current("Could not load meal plans. Please refresh and try again.")); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [selectedId, creatingNew]);

  const run = async (operation: () => Promise<MealPlan>) => {
    if (working.current || revisionBusy.size) return;
    const operationRoute = selectedId;
    operationEpoch.current++;
    working.current = true; setBusy(true); setError("");
    try {
      const updated = await operation();
      if (!mounted.current || route.current !== operationRoute) return;
      setPlan(current => current?.id === updated.id && current.version > updated.version ? current : updated);
      if (selectedId !== updated.id) setParams({ plan: updated.id });
      try { const list = await listMealPlans(); if (mounted.current && route.current === operationRoute) setSummaries(list); }
      catch { /* The mutation succeeded; history can be refreshed independently. */ }
    } catch (failure) {
      if (!mounted.current || route.current !== operationRoute) return;
      const status = failure && typeof failure === "object" && "status" in failure ? failure.status
        : failure && typeof failure === "object" && "response" in failure ? (failure.response as { status?: number })?.status : null;
      setError(status === 409 ? t("The plan changed or a meal is still generating. The latest saved version has been loaded.")
        : status === 422 ? t("Current offers could not provide enough priced ingredients. Change the stores, shopping date or selected offers. Saved meals are kept.")
        : status === 429 ? t("Generation limit reached. Your saved meals are safe. Try again later.")
        : t("This action could not finish. Your saved meals are safe. Refresh the plan before retrying."));
      if (selectedId) {
        try { const current = await getMealPlan(selectedId); if (mounted.current && route.current === operationRoute) applySaved(current); }
        catch { /* Keep the last confirmed snapshot and visible error. */ }
      }
    } finally {
      working.current = false; operationEpoch.current++;
      if (mounted.current) setBusy(false);
    }
  };

  useEffect(() => {
    setJob(null);
    if (!selectedId) return;
    let ignore = false;
    let polling = false;
    const poll = async () => {
      if (polling || working.current) return;
      polling = true;
      const epoch = operationEpoch.current;
      try {
        const [current, saved] = await Promise.all([getWeekGeneration(selectedId), getMealPlan(selectedId)]);
        if (ignore || epoch !== operationEpoch.current || working.current) return;
        setJob(current);
        setPlan(previous => previous?.id === saved.id && previous.version >= saved.version ? previous : saved);
      } catch { /* The last confirmed plan remains usable during a temporary polling failure. */ }
      finally { polling = false; }
    };
    void poll(); const timer = window.setInterval(() => void poll(), 2500);
    return () => { ignore = true; window.clearInterval(timer); };
  }, [selectedId]);
  useEffect(()=>{
    if(plan?.plan.schemaVersion!==4||job?.status!=="COMPLETED")return;
    const key=`recipeai-week-ready:${job.id}`;
    if(sessionStorage.getItem(key))return;
    captureEvent("week_cycle_ready",{slotCount:job.total,completedCount:job.completed,durationMs:Math.max(0,Date.now()-Date.parse(plan.createdAt))});
    sessionStorage.setItem(key,"1");
  },[job,plan]);
  const generateMissing = () => {
    if (!plan || working.current) return;
    const previousFinished = job?.id === jobRequest.current.id && job.status !== "QUEUED" && job.status !== "RUNNING";
    if (jobRequest.current.planId !== plan.id || jobRequest.current.version !== plan.version || previousFinished)
      jobRequest.current = { planId: plan.id, version: plan.version, id: crypto.randomUUID() };
    void run(async () => {
      const started = await startWeekGeneration(plan, jobRequest.current.id); if (mounted.current && route.current === plan.id) setJob(started);
      captureEvent("meal_plan_generation_requested", { planId: plan.id, generationId: started.id, dayCount: plan.plan.settings.dayCount, slotCount: started.total, servings: plan.plan.settings.servings });
      return getMealPlan(plan.id);
    });
  };
  const cancelGeneration = () => {
    if (!plan || !job) return;
    void run(async () => {
      const cancelled = await cancelWeekGeneration(plan.id, job.id);
      if (mounted.current && route.current === plan.id) setJob(cancelled);
      return getMealPlan(plan.id);
    });
  };
  const buildFromOffers = () => {
    if (!plan || working.current) return;
    const finished = job?.id === replanRequest.current.id && job.status !== "QUEUED" && job.status !== "RUNNING";
    if (replanRequest.current.planId !== plan.id || replanRequest.current.version !== plan.version || finished)
      replanRequest.current = { planId: plan.id, version: plan.version, id: crypto.randomUUID() };
    void run(async () => {
      const started = await replanFromOffers(plan, replanRequest.current.id);
      if (mounted.current && route.current === plan.id) setJob(started);
      return getMealPlan(plan.id);
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
  const generateSlot = (slotId: string) => {
    if (!plan) return;
    let request = slotRequests.current.get(slotId);
    if (!request || request.version !== plan.version) {
      request = { version: plan.version, id: crypto.randomUUID() }; slotRequests.current.set(slotId, request);
    }
    const requestId = request.id;
    void run(() => generatePlanSlot(plan, slotId, requestId));
  };
  const accept = () => {
    if (!plan) return;
    void run(async () => {
      const accepted = await acceptMealPlan(plan);
      captureEvent("meal_plan_accepted", { planId: accepted.id, fullSlotCount: planned, emptySlotCount: remaining, durationMs: Math.max(0, Date.now() - Date.parse(plan.createdAt)) });
      captureEvent("meal_plan_shopping_list_created", { planId: accepted.id, planVersion: accepted.version, itemCount: accepted.plan.shopping?.items.length ?? 0 });
      return accepted;
    });
  };
  const jobRunning = job?.status === "QUEUED" || job?.status === "RUNNING";
  const remoteBusy = jobRunning || (plan?.plan.slots.some(isSlotGenerating) ?? false);
  const disabled = busy || remoteBusy || revisionBusy.size > 0;
  const planned = plan?.plan.slots.filter(slot => slot.recipe && !slot.skipped).length ?? 0;
  const remaining = plan?.plan.slots.filter(slot => !slot.recipe && !slot.skipped).length ?? 0;
  const total = planned + remaining;
  const dates = [...new Set(plan?.plan.slots.map(slot => slot.date) ?? [])];
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
  const range = plan ? [dates[0] ?? plan.plan.settings.startDate, dates.at(-1) ?? plan.plan.settings.startDate].filter((date, index, all) => index === 0 || date !== all[0]).map(date => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`))).join(" – ") : t("Saved meal plans");
  const button = "min-h-11 rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold hover:bg-primary/5 disabled:opacity-40";
  const primary = "min-h-11 rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40";
  const menuButton = "block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/5 disabled:opacity-40";

  return <div className="planner mx-auto max-w-4xl px-4 pb-10 pt-5 text-primary sm:pt-8">
    <header className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="shrink-0 text-xl font-bold sm:text-2xl">{t("Meal planner")}</h1>
        <div className="flex items-center gap-2">
          {(plan || summaries.length > 0) && <button type="button" disabled={busy || revisionBusy.size > 0} onClick={() => setHistoryOpen(true)} className="min-h-11 whitespace-nowrap rounded-lg px-2 text-sm font-semibold">{range} ▾</button>}
          <PlannerMenu label={t("Plan options")} disabled={busy || revisionBusy.size > 0}>
            <button type="button" className={menuButton} onClick={() => navigatePlan({ new: "1" })}>{t("New plan")}</button>
            {summaries.length > 0 && <button type="button" className={menuButton} onClick={() => setHistoryOpen(true)}>{t("Saved meal plans")}</button>}
            {plan && <>
              <button type="button" className={menuButton} disabled={disabled} onClick={() => { setSettingsSnapshot(current => current ?? plan); setError(""); setEditingSettings(true); }}>{t("Planner settings")}</button>
              <button type="button" className={menuButton} disabled={busy} onClick={() => void run(() => getMealPlan(plan.id))}>{t("Refresh")}</button>
            </>}
          </PlannerMenu>
        </div>
      </div>
      {plan && <p className="mt-1 text-sm text-primary/70">{t("{count} people", { count: plan.plan.settings.servings })} · {t("{planned} of {total} meals", { planned, total })}</p>}
    </header>
    <PlannerDialog open={historyOpen} title={t("Saved meal plans")} onClose={() => setHistoryOpen(false)}>
      <ul className="divide-y divide-primary/10">{summaries.map(item => <li key={item.id}>
        <button type="button" className="min-h-14 w-full py-3 text-left" aria-current={item.id === selectedId ? "true" : undefined} onClick={() => navigatePlan({ plan: item.id })}>
          {item.startDate} · {item.plannedSlots}/{item.totalSlots} · {t(item.status === "ACCEPTED" ? "Accepted" : "Draft")}
        </button>
      </li>)}</ul>
      <button type="button" className={`${button} mt-4`} onClick={() => navigatePlan({ new: "1" })}>{t("New plan")}</button>
    </PlannerDialog>
    {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}
      <button disabled={busy} className="ml-3 min-h-11 underline" onClick={() => selectedId ? void run(() => getMealPlan(selectedId)) : window.location.reload()}>{t("Refresh")}</button></div>}
    {loading ? <p role="status">{t("Loading meal plans...")}</p> : !selectedId ? <MealPlanForm startDateHint={params.get("start") ?? undefined} busy={busy} onCreate={settings => void run(async () => {
      try {
        const saved = await startCycle(settings); clearIntent(`form:${user?.id ?? "current"}`); captureEvent("week_cycle_started", {dayCount: settings.dayCount, slotCount: saved.plan.slots.length}); return saved;
      } catch(error) {
        const status=error&&typeof error==="object"&&"status"in error?error.status:null;
        if([400,403,404,409,422,429].includes(Number(status)))clearIntent(`form:${user?.id ?? "current"}`);
        throw error;
      }
    })} /> : plan ? <>
      {plan.plan.schemaVersion >= 4 ? <WeekCycleWorkspace key={plan.id} plan={plan} onSaved={applySaved} onGenerate={generateSlot}
        onDraftChange={draftChanged} onBusyChange={setBusy} onResume={generateMissing} onStop={cancelGeneration} jobRunning={Boolean(jobRunning)} busy={busy}
        progress={job && job.status !== "COMPLETED" ? `${t(({QUEUED:"Queued",RUNNING:"Planning",COMPLETED:"Ready",FAILED:"Stopped after an error",CANCELLED:"Stopped"})[job.status])} · ${job.completed}/${job.total}${job.error==="AI_LIMIT_REACHED" ? ` · ${t("Generation limit reached. Your saved meals are safe. Try again later.")}` : job.error==="PRICE_COVERAGE_UNAVAILABLE" ? ` · ${t("Current offers could not provide enough priced ingredients. Change the stores, shopping date or selected offers. Saved meals are kept.")}` : ""}` : ""}
        onNextWeek={() => { const start = new Date(`${plan.plan.settings.startDate}T12:00:00`); start.setDate(start.getDate() + plan.plan.settings.dayCount);
          const date = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`; navigatePlan({new:"1",start:date}); }} /> : <>
      <nav aria-label={t("Plan views")} className="mb-4 flex gap-1 border-b border-primary/15">
        <button type="button" aria-current={view === "meals" ? "page" : undefined} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.delete("view"); return next; })}
          className={`min-h-11 flex-1 border-b-2 px-4 py-2 font-semibold ${view === "meals" ? "border-primary" : "border-transparent text-primary/60"}`}>{t("Week")}</button>
        <button type="button" aria-current={view === "shopping" ? "page" : undefined} onClick={showShopping}
          className={`min-h-11 flex-1 border-b-2 px-4 py-2 font-semibold ${view === "shopping" ? "border-primary" : "border-transparent text-primary/60"}`}>{t("Shopping")}</button>
      </nav>
      {(remoteBusy || job) && <div className="mb-4 rounded-lg bg-primary/5 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status">{jobRunning && job ? t("Planning meals: {completed}/{total}", { completed: job.completed, total: job.total })
            : remoteBusy ? t("Planning a meal…") : job ? `${t({ QUEUED: "Queued", RUNNING: "Planning", COMPLETED: "Ready", FAILED: "Stopped after an error", CANCELLED: "Stopped" }[job.status])} · ${job.completed}/${job.total}` : ""}</p>
          {jobRunning && <button className="min-h-11 px-2 underline disabled:opacity-40" disabled={busy} onClick={cancelGeneration}>{t("Stop after this meal")}</button>}
        </div>
        {job?.status === "FAILED" && <p role="alert" className="mt-1 text-amber-900">{t(job.error === "PRICE_COVERAGE_UNAVAILABLE" ? "Current offers could not provide enough priced ingredients. Change the stores, shopping date or selected offers. Saved meals are kept." : "Planning stopped. Saved meals are safe. Refresh and retry missing meals.")}</p>}
      </div>}
      <div hidden={view !== "meals"}>
        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            {remaining > 0 || planned === 0 ? <button className={primary} disabled={disabled || remaining === 0} onClick={generateMissing}>{t(planned ? "Complete the week" : "Plan the week")}</button>
              : <button className={primary} onClick={showShopping}>{t("Go to shopping")}</button>}
            {remaining > 0 && planned > 0 && <button className="min-h-11 px-3 text-sm font-semibold underline" onClick={showShopping}>{t("Go to shopping")}</button>}
          </div>
          <p className="mt-2 text-xs text-primary/65">{t(remaining > 0 ? "Saved meals stay. AI uses your recipe allowance; planning continues in the background." : planned > 0 ? "Swapping a meal uses your recipe allowance." : "Restore a skipped meal to start planning.")}</p>
        </div>
        <div className="space-y-6">{dates.map(date => <section key={date} aria-label={dateLabel(date)}>
          <h2 className="text-base font-bold first-letter:uppercase">{dateLabel(date)}</h2>
          <div>{plan.plan.slots.filter(slot => slot.date === date).map(slot => <MealPlanSlotCard key={`${plan.id}:${slot.id}`} slot={slot} busy={disabled} plan={plan} onApplied={applySaved} onDraftChange={draftChanged} onBusyChange={revisionBusyChanged}
            onGenerate={() => generateSlot(slot.id)} onChange={(action, servings) => void run(() => changePlanSlot(plan, slot.id, action, servings))} />)}</div>
        </section>)}</div>
      </div>
      <div hidden={view !== "shopping"}>
        {plan.plan.shopping ? <section aria-label={t("Shopping for this plan")}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{t("Shopping for this plan")}</h2>
            <button disabled={disabled} className={button} onClick={() => void run(() => refreshPlanShopping(plan))}>{t("Recalculate from fridge")}</button></div>
          <PlanShoppingGroups onOpenMeal={slotId => {
            setParams({ plan: plan.id });
            requestAnimationFrame(() => { const slot = document.getElementById(`meal-slot-${slotId}`); slot?.scrollIntoView({ block: "center" }); slot?.querySelector("button")?.focus(); });
          }} plan={plan} disabled={disabled} onCheck={toggleShopping} />
          <p className="mt-3 text-xs text-primary/60">{t("This checklist belongs to this plan. Your manual shopping list is unchanged.")}</p>
        </section> : <section className="space-y-3 py-2">
          <h2 className="text-lg font-bold">{t("Shopping for this plan")}</h2>
          <p className="text-sm text-primary/70">{t("Accept these meals to create your checklist. Empty and skipped meals are excluded.")}</p>
          <button className={primary} disabled={disabled || planned === 0} onClick={accept}>{t("Accept plan and create shopping list")}</button>
        </section>}
        {shoppingVisited && planned > 0 && <MealPlanPricing key={plan.id} plan={plan} disabled={disabled} auto compact onSelected={applySaved} />}
        {offersAvailable && <PlannerDisclosure className="mt-5 border-t border-primary/15 pt-3" title={t("Offers and replanning")} onOpen={() => setOffersOpen(true)}>
          {offersOpen && <MealPlanOffers plan={plan} disabled={disabled} onReplan={buildFromOffers} />}
        </PlannerDisclosure>}
      </div>
      </>}
      <PlannerDialog open={editingSettings} title={t("Planner settings")} onClose={() => setEditingSettings(false)}>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {settingsSnapshot && settingsSnapshot.version !== plan.version && <div className="mb-4 space-y-2 text-sm">
          <p role="alert">{t("The plan changed. Your settings draft is kept. Reload saved settings before retrying.")}</p>
          <button type="button" className={button} onClick={() => {
            if (!drafts.current.has("settings") || window.confirm(t("Discard unfinished changes?"))) { settingsDraftChanged(false); setSettingsSnapshot(plan); }
          }}>{t("Reload saved settings")}</button>
        </div>}
        {settingsSnapshot && <MealPlanForm key={`${settingsSnapshot.id}:${settingsSnapshot.version}`} onDraftChange={settingsDraftChanged} initialSettings={settingsSnapshot.plan.settings} busy={disabled} onCreate={settings => void run(async () => {
          const updated = await updatePlanSettings(settingsSnapshot, settings); setEditingSettings(false); setSettingsSnapshot(null); settingsDraftChanged(false); return updated;
        })} />}
      </PlannerDialog>
    </> : null}
  </div>;
}
