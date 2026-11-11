import { useEffect, useState } from "react";
import PlannerDisclosure from "./PlannerDisclosure";
import StorePriceSources from "./StorePriceSources";
import { useLanguage } from "../context/languageContext";
import { getPlanningOffers, type MealPlan } from "../lib/mealPlans";
import { type CatalogOffer } from "../lib/planPricing";
import { useOffersAccess } from "../context/offersAccessContext";

export default function MealPlanOffers({ plan, disabled, onReplan }: { plan: MealPlan; disabled: boolean; onReplan: () => void }) {
  const { t, locale } = useLanguage();
  const available = useOffersAccess();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const planId = plan.id; const version = plan.version;
  useEffect(() => {
    if (!available) return;
    let ignore = false;
    setState("loading");
    void getPlanningOffers({ id: planId, version }).then(result => {
      if (ignore) return;
      if (result.version !== version) { setState("error"); return; }
      setOffers(result.offers); setState("ready");
    }).catch(() => { if (!ignore) setState("error"); });
    return () => { ignore = true; };
  }, [planId, version, available]);
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(n);
  const unique = offers.filter((o, index) => offers.findIndex(other => (other.ingredientKey ?? other.details.ingredientId ?? other.id)
    === (o.ingredientKey ?? o.details.ingredientId ?? o.id) && other.details.store === o.details.store) === index);
  const unlocked = plan.plan.slots.some(s => !s.locked && !s.skipped);
  if (!available) return null;
  return <section className="py-3" aria-label={t("Offers for this plan")}>
    <h2 className="text-xl font-bold">{t("Offers for this plan")}</h2>
    <p className="mt-2 text-sm">{t("Offers match your stores, shopping date and dietary preferences.")}</p>
    <p className="mt-2 text-sm text-primary/70">{t("The catalog is partial. New meals must have prices for at least half their shopping ingredients. Remaining prices are shown as missing.")}</p>
    <StorePriceSources />
    {state === "loading" && <p role="status" className="mt-3">{t("Finding usable priced products...")}</p>}
    {state === "error" && <p role="alert" className="mt-3">{t("Could not check offers. Refresh the plan before planning.")}</p>}
    {state === "ready" && !unique.length && <p role="status" className="mt-3 text-amber-900">{t("No priced products match your stores, shopping date and dietary preferences. Try another store or date in planner settings.")}</p>}
    {state === "ready" && unique.length > 0 && <PlannerDisclosure className="mt-3" defaultOpen title={`${t("Priced products available for this plan")}: ${unique.length}`}>
      <ul aria-label={t("Priced products available for this plan")} tabIndex={0} className="planner-scroll-list mt-2 grid items-start gap-2 rounded-lg px-1 sm:grid-cols-2 lg:grid-cols-3">{unique.map(o => <li key={o.id} className="rounded-xl bg-primary/5 p-3 text-sm">
        <p className="font-semibold">{o.details.productName}</p>
        <p>{o.details.store === "LIDL" ? "Lidl" : "Biedronka"} · {o.details.packageAmount} {o.details.unit} · {o.details.packagePrice != null ? money(o.details.packagePrice) : `${money(o.details.bundlePrice!)} / ${o.details.bundleSize} × ${t("package")}`}</p>
        <a className="underline" href={o.details.sourceUrl} target="_blank" rel="noopener noreferrer">{t("Offer source")}</a>
        <PlannerDisclosure className="mt-1" title={t("Offer conditions")}><p className="px-2 pb-2">{o.details.conditions}</p></PlannerDisclosure>
      </li>)}</ul>
      <p className="mt-2 text-xs text-primary/70">{t("Package prices above keep the store's conditions. The final basket includes whole packages and promotion limits.")}</p>
    </PlannerDisclosure>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="rounded-lg border border-primary/20 px-5 py-3 font-semibold disabled:opacity-40" disabled={disabled || state !== "ready" || !offers.length || !unlocked} onClick={onReplan}>{t("Build plan from these offers")}</button>

    </div>
    <p className="mt-2 text-sm text-primary/70">{t("Replaces unlocked meals and fills empty slots. Locked and skipped meals are kept. Uses your recipe allowance.")}</p>
  </section>;
}
