import { useState, type FormEvent } from "react";
import { useLanguage } from "../context/languageContext";
import type { MealPlan, PlanStore } from "../lib/mealPlans";
import { savePlanPrice, removePlanPrice, type PricedItem } from "../lib/planPricing";

export default function PlanPriceEntry({ plan, item, stores, shoppingDate, disabled, onSaved }: {
  plan: MealPlan; item: PricedItem; stores: PlanStore[]; shoppingDate: string; disabled: boolean; onSaved: (plan: MealPlan) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState<PlanStore>(item.manualPrice?.store ?? stores[0]);
  const [amount, setAmount] = useState(String(item.manualPrice?.packageAmount ?? ""));
  const [price, setPrice] = useState(String(item.manualPrice?.packagePrice ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unit = item.unit ?? item.manualPrice?.unit ?? plan.plan.shopping?.items.find(i => i.key === item.key)?.unit;
  if (!unit || item.missingReason === "CHECK_QUANTITY") return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (disabled || busy) return;
    setBusy(true); setError("");
    try { onSaved(await savePlanPrice(plan, { key: item.key, store, shoppingDate, packageAmount: Number(amount), packagePrice: Number(price) })); }
    catch { setError(t("Could not save this price. Refresh the plan and check the amount.")); }
    finally { setBusy(false); }
  };
  return <div className="mt-3">
    <button type="button" disabled={disabled || busy} className="text-sm underline disabled:opacity-40" onClick={() => setOpen(v => !v)}>{t(item.manualPrice ? "Edit your price" : "Add a known price")}</button>
    {open && <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl bg-primary/5 p-3" aria-label={t("Price for {name}", { name: item.name })}>
      <fieldset disabled={disabled || busy} className="space-y-3">
        <p className="text-sm">{t("Your price is private to this plan and shopping date. We count whole packages.")}</p>
        <label className="block text-sm">{t("Store")}<select className="mt-1 w-full rounded-lg border border-primary/20 bg-white p-2" value={store} onChange={e => { if (e.target.value === "LIDL" || e.target.value === "BIEDRONKA") setStore(e.target.value); }}>
          {stores.map(s => <option key={s} value={s}>{s === "LIDL" ? "Lidl" : "Biedronka"}</option>)}
        </select></label>
        <label className="block text-sm">{t("Amount in one package")} ({unit})<input type="number" required min={unit === "pcs" ? 1 : 0.001} max={1000000} step={unit === "pcs" ? 1 : 0.001} value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-primary/20 bg-white p-2" /></label>
        <label className="block text-sm">{t("Price per package (PLN)")}<input type="number" required min="0.01" max="100000" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-primary/20 bg-white p-2" /></label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-full border border-primary/20 px-3 py-2 text-sm">{t(busy ? "Saving..." : "Save price")}</button>
          {item.manualPrice && <button type="button" className="text-sm underline" onClick={() => {
            setBusy(true); setError(""); void removePlanPrice(plan, item.manualPrice!.id).then(onSaved)
              .catch(() => setError(t("Could not save this price. Refresh the plan and check the amount."))).finally(() => setBusy(false));
          }}>{t("Remove your price")}</button>}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>}
  </div>;
}
