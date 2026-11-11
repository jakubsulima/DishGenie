import { useLanguage } from "../context/languageContext";
import PlannerDisclosure from "./PlannerDisclosure";

const sources = [
  ["Food and drinks", "https://www.lidl.pl/c/zywnosc-i-napoje/s10068374"],
];
export default function StorePriceSources() {
  const { t } = useLanguage();
  return <PlannerDisclosure className="mt-3 text-sm" title={t("Where do prices come from?")}>
    <p className="mt-2 text-primary/70">{t("We collect meal ingredients from the official Lidl catalog, including further result pages. Offers are shown for your shopping date. Ready-made sweet pastries, sweets and snacks are excluded. Coverage is partial. Biedronka has no automatic price feed yet.")}</p>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{sources.map(([name, url]) => <li key={url}><a className="underline" href={url} target="_blank" rel="noopener noreferrer">{t(name)}</a></li>)}</ul>
    <p className="mt-2 text-primary/70">{t("Each product links to its source and conditions. Coupons need separate confirmation. You can enter missing prices yourself.")}</p>
  </PlannerDisclosure>;
}
