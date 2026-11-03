import PlanShoppingIssue from "./PlanShoppingIssue";
import { useEffect, useState } from "react";
import { useLanguage } from "../context/languageContext";
import type { MealPlan } from "../lib/mealPlans";
export default function PlanShoppingGroups({ plan, disabled, onCheck }: { plan: MealPlan; disabled: boolean; onCheck: (key: string, checked: boolean) => void }) {
  const { t } = useLanguage(); const shopping = plan.plan.shopping;
  const quote = shopping?.quote;
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (!quote) return;
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, Date.parse(quote.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [quote]);
  if (!shopping) return null;
  const basket = quote?.baskets.find(b => b.option === shopping.basketOption);
  const stale = expired || !quote || Date.parse(quote.expiresAt) <= Date.now();
  const groups = new Map<string, typeof shopping.items>();
  for (const item of shopping.items) {
    const priced = basket?.items.find(i => i.key === item.key);
    const store = priced?.offer?.details.store ?? (shopping.basketOption === "COMBINED" ? "Choose store" : shopping.basketOption ?? "Choose basket above");
    const category = priced?.offer?.details.category ?? "OTHER";
    const key = `${store}|${category}`;
    groups.set(key, [...groups.get(key) ?? [], item]);
  }
  return <div className="mt-5 space-y-5">
    {shopping.basketOption && stale && <p role="status" className="text-amber-900">{t("Refresh prices before shopping. Your checklist is preserved.")}</p>}
    {[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => <section key={group}>
      <h3 className="font-bold">{group.split("|").map(part => t(({ LIDL: "Lidl", BIEDRONKA: "Biedronka", VEGETABLES: "Vegetables", FRUIT: "Fruit", MEAT_FISH: "Meat and fish", DAIRY: "Dairy", DRY: "Dry goods", OTHER: "Other items" } as Record<string, string>)[part] ?? part)).join(" · ")}</h3>
      <ul className="divide-y divide-primary/10">{items.map(item => {
        const priced = basket?.items.find(i => i.key === item.key);
        return <li key={item.key} className="flex items-start gap-3 py-3">
          {item.amount !== 0 && <input className="mt-1 h-5 w-5 shrink-0" type="checkbox" aria-label={item.name} checked={shopping.checkedKeys.includes(item.key)} disabled={disabled} onChange={e => onCheck(item.key, e.target.checked)} />}
          <div><span className="font-semibold">{item.name}</span> · {item.amount === null ? t("Check quantity") : item.amount === 0 ? t("Available in fridge") : `${item.amount} ${item.unit}`}
            {item.usedFromFridge > 0 && <p className="text-sm">{t("From fridge")}: {item.usedFromFridge} {item.unit}</p>}
            {item.needsReview && <p className="text-sm text-amber-900">{t("Check the amount and unit at home before shopping.")}</p>}
            {priced?.offer && <><p className="text-sm">{t("Buy")}: {priced.purchasedAmount} {item.unit} · {t("Left after these meals")}: {priced.leftoverAmount} {item.unit}</p><p className="text-sm">{priced.offer.details.conditions}</p><p className="text-sm">{priced.offer.details.validFrom} – {priced.offer.details.validTo}</p><a className="text-sm underline" href={priced.offer.details.sourceUrl} target="_blank" rel="noopener noreferrer">{t("Offer source")}</a></>}
            {item.amount !== 0 && <PlanShoppingIssue plan={plan} itemKey={item.key} slotId={item.slotIds[0]} disabled={disabled} />}
          </div>
        </li>;
      })}</ul>
    </section>)}
  </div>;
}
