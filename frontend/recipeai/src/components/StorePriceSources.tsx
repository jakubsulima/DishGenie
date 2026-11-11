import { useLanguage } from "../context/languageContext";
import PlannerDisclosure from "./PlannerDisclosure";

const sources = [
  ["Lidl leaflets", "https://www.lidl.pl/c/nasze-gazetki/s10008614"],
];
export default function StorePriceSources() {
  const { t } = useLanguage();
  return <PlannerDisclosure className="mt-3 text-sm" title={t("Where do prices come from?")}>
    <p className="mt-2 text-primary/70">{t("We read the complete official Lidl leaflet and use reviewed meal ingredients for your shopping date. Duplicates, non-food items, sweets, snacks and unclear conditions are excluded. A changed leaflet needs a new review. Biedronka has no automatic price feed yet.")}</p>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{sources.map(([name, url]) => <li key={url}><a className="underline" href={url} target="_blank" rel="noopener noreferrer">{t(name)}</a></li>)}</ul>
    <p className="mt-2 text-primary/70">{t("Each product links to its source and conditions. Coupons need separate confirmation. You can enter missing prices yourself.")}</p>
  </PlannerDisclosure>;
}
