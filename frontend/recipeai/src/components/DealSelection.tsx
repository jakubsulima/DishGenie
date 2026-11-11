import { useEffect, useState } from "react";
import { useLanguage } from "../context/languageContext";
import { getOffers, type CatalogOffer } from "../lib/planPricing";
import type { PlanStore } from "../lib/mealPlans";
export default function DealSelection({ stores, shoppingDate, loyaltyStores, selected, confirmed, onSelected, onConfirmed }: {
  stores: PlanStore[]; shoppingDate: string; loyaltyStores: PlanStore[]; selected: string[]; confirmed: string[];
  onSelected: (ids: string[]) => void; onConfirmed: (ids: string[]) => void;
}) {
  const { t, locale } = useLanguage();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [status, setStatus] = useState("Loading offers...");
  const storeKey = stores.join(",");
  useEffect(() => {
    let ignore = false; setOffers([]); setStatus("Loading offers...");
    if (!storeKey || !shoppingDate) { setStatus("Choose stores and a shopping date."); return; }
    getOffers(storeKey.split(",") as PlanStore[], shoppingDate).then(result => {
      if (!ignore) { setOffers(result.offers); setStatus(result.offers.length ? "" : "No current verified offers. You can still plan your week."); }
    }).catch(() => { if (!ignore) setStatus("Offers unavailable. You can still plan your week."); });
    return () => { ignore = true; };
  }, [storeKey, shoppingDate]);
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(n);
  const toggle = (ids: string[], id: string, checked: boolean) => checked ? [...ids, id] : ids.filter(i => i !== id);
  return <details className="rounded-2xl border border-primary/15 p-4">
    <summary className="cursor-pointer font-semibold">{t("Offers for this week (optional)")}</summary>
    <p className="mt-3 text-sm">{t("We choose useful offers automatically. Optionally select products to build your week around.")}</p>
    <p className="mt-2 text-sm">{t("The available catalog can be partial. Check each offer's dates and conditions.")}</p>
    {status && <p role="status" className="mt-3">{t(status)}</p>}
    <ul className="mt-4 grid gap-4 sm:grid-cols-2">{offers.map(offer => {
      const d = offer.details;
      const usable = (!d.loyaltyRequired || loyaltyStores.includes(d.store)) && (!(d.couponRequired ?? d.loyaltyRequired) || confirmed.includes(offer.id));
      const minimum = Math.ceil(d.minimumPackages / d.packageMultiple) * d.packageMultiple;
      return <li key={offer.id} className="rounded-xl border border-primary/15 p-3">
        <label className="flex gap-2 font-semibold"><input type="checkbox" disabled={!usable || selected.length >= 30 && !selected.includes(offer.id)} checked={selected.includes(offer.id)} onChange={e => onSelected(toggle(selected, offer.id, e.target.checked))} />{d.productName}</label>
        <p>{d.store === "LIDL" ? "Lidl" : "Biedronka"} · {d.packageAmount} {d.unit} · {d.bundlePrice && d.bundleSize ? `${d.bundleSize} × ${t("package")}: ${money(d.bundlePrice)}` : money(d.packagePrice!)}{d.weighted && ` / ${d.packageAmount} ${d.unit}`}</p>
        <p className="text-sm">{d.validFrom} – {d.validTo}</p>
        {!d.weighted && <p className="text-sm">{t("Minimum spend")}: {money(d.bundlePrice && d.bundleSize ? minimum / d.bundleSize * d.bundlePrice : minimum * d.packagePrice!)}</p>}
        <p className="mt-2 text-sm">{d.conditions}</p>
        {(d.couponRequired ?? d.loyaltyRequired) && <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" disabled={d.loyaltyRequired && !loyaltyStores.includes(d.store)} checked={confirmed.includes(offer.id)} onChange={e => { onConfirmed(toggle(confirmed, offer.id, e.target.checked)); if (!e.target.checked) onSelected(selected.filter(i => i !== offer.id)); }} />{t("I confirm I can use this specific coupon")}</label>}
        <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline">{t("Offer source")}</a>
      </li>;
    })}</ul>
  </details>;
}
