import { useRef, useState } from "react";
import { useLanguage } from "../context/languageContext";
import { reportPlanShoppingIssue, type MealPlan } from "../lib/mealPlans";
export default function PlanShoppingIssue({ plan, itemKey, slotId, disabled }: { plan: MealPlan; itemKey: string; slotId?: string; disabled: boolean }) {
  const { t } = useLanguage(); const [reason, setReason] = useState<"MISSING_PRODUCT" | "PRICE_DIFFERENT">("MISSING_PRODUCT");
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState(false);
  const request = useRef({ signature: "", id: "" });
  return <details className="mt-2 text-sm"><summary className="cursor-pointer underline">{t("Product unavailable or price different?")}</summary>
    <div className="mt-2 space-y-2"><label className="block">{t("What happened?")}<select className="ml-2 max-w-full rounded border p-2" value={reason} disabled={busy || disabled} onChange={e => { setReason(e.target.value as typeof reason); setSaved(false); }}>
      <option value="MISSING_PRODUCT">{t("Product unavailable")}</option><option value="PRICE_DIFFERENT">{t("Different price in store")}</option>
    </select></label>
    <button type="button" className="rounded border px-3 py-2 disabled:opacity-40" disabled={busy || disabled || saved} onClick={() => {
      const signature = `${plan.version}:${itemKey}:${reason}`; if (request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
      setBusy(true); setError(false); void reportPlanShoppingIssue(plan, itemKey, reason, request.current.id).then(() => setSaved(true)).catch(() => setError(true)).finally(() => setBusy(false));
    }}>{t("Save report")}</button>
    {saved && <p role="status">{t("Report saved. Your plan and global prices are unchanged.")}</p>}
    {error && <p role="alert">{t("Could not save the report. Refresh before retrying.")}</p>}
    {slotId && <a className="block underline" href={`#meal-slot-${slotId}`}>{t("Open the meal to choose an alternative")}</a>}
    </div>
  </details>;
}
