import { captureEvent } from "../lib/posthog";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/languageContext";
import { latestPlanRevision, applyRevision, previewRevision, undoRevision, type MealPlan, type PlanSlot, type PlanRecipe, type RevisionIntent, type RevisionPreview } from "../lib/mealPlans";
import { getOffers, type CatalogOffer } from "../lib/planPricing";
export default function MealPlanRevision({ plan, slot, disabled, onApplied, autoStart = false, onDraftChange, onBusyChange }: { plan: MealPlan; slot: PlanSlot; disabled: boolean; onApplied: (plan: MealPlan) => void; autoStart?: boolean; onDraftChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(autoStart);
  const [intent, setIntent] = useState<RevisionIntent>("MANUAL");
  const [draft, setDraft] = useState<PlanRecipe | null>(() => autoStart ? structuredClone(slot.recipe) : null);
  const [ingredient, setIngredient] = useState(slot.recipe?.ingredients[0]?.name ?? "");
  const [replacement, setReplacement] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [comment, setComment] = useState("");
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [offerId, setOfferId] = useState("");
  const [preview, setPreview] = useState<RevisionPreview | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { onDraftChange?.(dirty); }, [dirty, onDraftChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const editVersion = useRef(0);
  const invalidatePreview = () => { editVersion.current++; setPreview(null); setDirty(true); };
  const request = useRef({ signature: "", id: "", recipe: autoStart ? JSON.stringify(slot.recipe) : "" });
  const staleDraft = open && request.current.recipe !== JSON.stringify(slot.recipe);
  const locked = disabled || busy || slot.locked || slot.skipped;
  const button = "rounded-lg border border-primary/20 px-4 py-2 text-sm disabled:opacity-40";
  const field = "min-w-0 w-full rounded-lg border border-primary/20 p-2";
  const begin = () => {
    if (dirty && !window.confirm(t("Discard the unfinished recipe changes?"))) return;
    request.current = { signature: "", id: "", recipe: JSON.stringify(slot.recipe) };
    setDraft(structuredClone(slot.recipe)); invalidatePreview(); setDirty(false); setOpen(true); setError(""); setIngredient(slot.recipe?.ingredients[0]?.name ?? "");
  };
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    void latestPlanRevision(plan.id, slot.id).then(result => { if (!ignore) setUndoId(result.id ?? null); }).catch(() => {});
    const settings = plan.plan.settings;
    void getOffers(settings.stores, settings.shopping?.shoppingDate ?? settings.startDate).then(result => {
      const cards = settings.shopping?.loyaltyStores ?? []; const coupons = settings.shopping?.confirmedCouponOffers ?? [];
      if (ignore) return;
      setOffers(result.offers.filter(o => (!o.details.loyaltyRequired || cards.includes(o.details.store)) && (!(o.details.couponRequired ?? o.details.loyaltyRequired) || coupons.includes(o.id))));
    }).catch(() => { if (!ignore) setOffers([]); });
    return () => { ignore = true; };
  }, [open, plan.id, slot.id, plan.plan.settings]);
  const action = async (operation: () => Promise<void>) => {
    if (locked || staleDraft) return; setBusy(true); setError("");
    try { await operation(); } catch { setError(t("Could not revise this meal. Check your changes or refresh the plan before retrying.")); }
    finally { setBusy(false); }
  };
  const propose = () => void action(async () => {
    if (!draft) return;
    const fields = { intent, ...(intent === "MANUAL" ? { recipe: draft } : {}), ingredient, replacement, comment, offerId: offerId || undefined, ...(intent === "FASTER" ? { maxMinutes: minutes } : {}) };
    const signature = JSON.stringify({ fields, version: plan.version });
    if (request.current.signature !== signature) request.current = { ...request.current, signature, id: crypto.randomUUID() };
    const version = editVersion.current;
    const result = await previewRevision(plan, slot.id, { ...fields, requestId: request.current.id });
    if (version === editVersion.current) { setPreview(result); setDirty(true); }
  });
  const quantities = (shopping: RevisionPreview["shoppingAfter"]) => shopping.items.map(i => `${i.name}: ${i.amount ?? t("Check quantity")} ${i.unit}`).join(" · ");
  return <div className="mt-4 border-t border-primary/10 pt-3">
    <div className="flex flex-wrap gap-2"><button type="button" className={button} hidden={autoStart && open && !staleDraft} disabled={locked} onClick={begin}>{t("Edit recipe")}</button>
      {undoId && <button type="button" className={button} disabled={locked || staleDraft} onClick={() => { if (dirty && !window.confirm(t("Discard the unfinished recipe changes?"))) return; void action(async () => { const version = editVersion.current; const result = await undoRevision(plan, slot.id, undoId);
        if (version === editVersion.current) {
          request.current = { signature: "", id: "", recipe: JSON.stringify(slot.recipe) };
          setDraft(structuredClone(slot.recipe)); setPreview(result); setDirty(true); setOpen(true);
        } }); }}>{t("Preview undo")}</button>}</div>
    {open && draft && <div className="mt-4 space-y-3" role="region" aria-label={t("Edit recipe")}>
      {staleDraft && <p role="alert" className="text-amber-900">{t("This meal changed while you were editing. Your draft is kept. Reopen the editor to edit the current meal.")}</p>}
      <fieldset disabled={locked} onChange={invalidatePreview} className="space-y-3">
      <label className="block">{t("Change type")}<select className={field} value={intent} disabled={busy} onChange={e => { setIntent(e.target.value as RevisionIntent); setPreview(null); }}>
        <option value="MANUAL">{t("Edit manually")}</option><option value="SUBSTITUTE">{t("Replace ingredient")}</option><option value="DEAL">{t("Use another offer")}</option><option value="FASTER">{t("Make it faster")}</option><option value="SIMPLIFY">{t("Simplify recipe")}</option><option value="TRANSLATE_PL">{t("Translate into Polish")}</option>
      </select></label>
      {intent !== "MANUAL" && intent !== "TRANSLATE_PL" && <p className="text-sm">{t("AI changes use your recipe allowance.")}</p>}
      {intent === "TRANSLATE_PL" && <p className="text-sm">{t("Translate the name, description, ingredients and instructions. Quantities and servings stay the same. Uses your recipe allowance.")}</p>}
      {intent === "MANUAL" && <>
        <label className="block">{t("Recipe name")}<input className={field} value={draft.name} maxLength={160} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="block">{t("Preparation time in minutes")}<input className={field} value={draft.timeToPrepare} onChange={e => setDraft({ ...draft, timeToPrepare: e.target.value })} /></label>
        <fieldset><legend>{t("Ingredients")}</legend>{draft.ingredients.map((i, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_5rem_4rem_auto] gap-1">
          <input aria-label={`${t("Ingredient")} ${index + 1}`} className={`${field} col-span-3 sm:col-span-1`} value={i.name} onChange={e => setDraft({ ...draft, ingredients: draft.ingredients.map((v, n) => n === index ? { ...v, name: e.target.value } : v) })} />
          <input aria-label={`${t("Quantity")} ${index + 1}`} className={field} type="number" min="0.001" step="any" value={i.amount} onChange={e => setDraft({ ...draft, ingredients: draft.ingredients.map((v, n) => n === index ? { ...v, amount: Number(e.target.value) } : v) })} />
          <input aria-label={`${t("Unit")} ${index + 1}`} className={field} value={i.unit} onChange={e => setDraft({ ...draft, ingredients: draft.ingredients.map((v, n) => n === index ? { ...v, unit: e.target.value } : v) })} />
          <button type="button" className="min-h-11 min-w-11 rounded-xl border border-primary/20" aria-label={`${t("Remove ingredient")} ${index + 1}`} onClick={() => { invalidatePreview(); setDraft({ ...draft, ingredients: draft.ingredients.filter((_, n) => n !== index) }); }}>×</button>
        </div>)}<button type="button" className={`${button} mt-2`} onClick={() => { invalidatePreview(); setDraft({ ...draft, ingredients: [...draft.ingredients, { name: "", amount: 1, unit: "g" }] }); }}>{t("Add ingredient")}</button></fieldset>
        <label className="block">{t("Instructions (one step per line)")}<textarea className={`${field} min-h-36`} value={draft.instructions.join("\n")} onChange={e => setDraft({ ...draft, instructions: e.target.value.split("\n") })} /></label>
        <p className="text-sm">{t("When changing ingredients, update the instructions too.")}</p>
      </>}
      {intent === "SUBSTITUTE" && <><label className="block">{t("Ingredient")}<select className={field} value={ingredient} onChange={e => setIngredient(e.target.value)}>{slot.recipe?.ingredients.map((i, n) => <option key={n}>{i.name}</option>)}</select></label><label className="block">{t("Replacement")}<input className={field} value={replacement} maxLength={160} onChange={e => setReplacement(e.target.value)} /></label></>}
      {intent === "DEAL" && <label className="block">{t("Available offer")}<select className={field} value={offerId} onChange={e => setOfferId(e.target.value)}><option value="">{t("Choose an offer")}</option>{offers.map(o => <option key={o.id} value={o.id}>{o.details.productName} · {o.details.store}</option>)}</select></label>}
      {intent === "FASTER" && <label className="block">{t("Maximum minutes per meal")}<input className={field} type="number" min={5} max={plan.plan.settings.maxMinutes} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>}
      {intent !== "MANUAL" && <label className="block">{t("Reason or request (optional)")}<textarea className={field} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} /></label>}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={locked || staleDraft} onClick={propose}>{busy ? t("Preparing preview...") : t("Preview change")}</button><button type="button" hidden={autoStart} className={button} disabled={busy} onClick={() => { if (!dirty || window.confirm(t("Discard the unfinished recipe changes?"))) { setOpen(false); setDirty(false); } }}>{t("Close")}</button></div>
      </fieldset>
      {preview && <section className="space-y-3 rounded-xl bg-primary/5 p-3" aria-label={t("Change preview")}>
        <p className="font-semibold">{preview.before.name} → {preview.after.name}</p>
        {preview.after.description && <p>{preview.after.description}</p>}
        <ul className="list-disc pl-4">{preview.after.ingredients.map((i, n) => <li key={n}>{i.amount} {i.unit} {i.name}</li>)}</ul>
        <ol className="list-decimal pl-4">{preview.after.instructions.map((i, n) => <li key={n}>{i}</li>)}</ol>
        <p className="text-sm">{t("Shopping before")}: {quantities(preview.shoppingBefore)}</p><p className="text-sm">{t("Shopping after")}: {quantities(preview.shoppingAfter)}</p>
        {preview.quoteAfter?.baskets.map(after => {
          const before = preview.quoteBefore?.baskets.find(b => b.option === after.option);
          const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(n);
          return <p className="text-sm" key={after.option}>{after.option}: {t("Known prices")}: {before ? money(before.knownTotal) : "?"} → {money(after.knownTotal)} · {t("Missing prices")}: {after.missingItems}
            {before && before.missingItems === 0 && after.missingItems === 0 && <span> · {t("Change in shopping cost")}: {money(after.knownTotal - before.knownTotal)}</span>}</p>;
        })}
        {preview.unusedProducts && <p>{t("No longer needed")}: {preview.unusedProducts.join(", ") || "—"}</p>}
        {preview.affectedSlots && <p>{t("Affected meals")}: {preview.affectedSlots.length}</p>}
        <p className="text-sm">{t("Cost is recalculated after applying. Missing prices do not confirm savings.")}</p>
        <button type="button" className={button} disabled={locked || staleDraft || preview.planVersion !== plan.version} onClick={() => void action(async () => {
          const updated = await applyRevision(plan, slot.id, preview.id); setUndoId(preview.id); setPreview(null); setOpen(false); setDirty(false); onApplied(updated); captureEvent("meal_plan_revision_applied", { planId: plan.id, slotId: slot.id, revisionId: preview.id, intentCode: intent });
        })}>{t("Apply this change")}</button>
      </section>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>}
  </div>;
}
