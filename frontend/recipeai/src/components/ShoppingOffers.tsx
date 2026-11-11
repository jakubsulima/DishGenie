import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getOffers, refreshStorePrices, type CatalogOffer, type LeafletImportSummary } from '../lib/planPricing';
import { localDateInput } from '../lib/mealPlans';
import { useLanguage } from '../context/languageContext';
import { useOffersAccess } from '../context/offersAccessContext';

export default function ShoppingOffers() {
  const { locale } = useLanguage();
  const available = useOffersAccess();
  const pl = locale === 'pl';
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<CatalogOffer[] | null>(null);
  const [summary, setSummary] = useState<LeafletImportSummary | null>(null);
  const [sourceStatus, setSourceStatus] = useState('');
  const groups = new Map<string, CatalogOffer[]>();
  offers?.forEach(offer => {
    const key = `${offer.details.store}|${offer.details.sourceUrl}|${offer.details.productName}|${offer.details.packageAmount}|${offer.details.unit}`;
    groups.set(key, [...(groups.get(key) ?? []), offer]);
  });
  const productCount = groups.size;
  const [error, setError] = useState(false);
  async function load() {
    setBusy(true); setError(false);
    try {
      await refreshStorePrices();
      const days = await Promise.all(Array.from({ length: 7 }, (_, i) => getOffers(['LIDL'], localDateInput(i))));
      const imported = days.find(day => day.importSummary)?.importSummary ?? null;
      setSummary(imported);
      setSourceStatus(days[0].sourceStatus);
      const failed = days.some(day => ['LIVE_LEAFLET_FETCH_FAILED', 'LIVE_LEAFLET_REVIEW_REQUIRED'].includes(day.sourceStatus));
      setError(failed);
      const unique = [...new Map(days.flatMap(day => day.offers).map(offer => [offer.id, offer])).values()];
      setOffers(unique);
      const firstDay = imported?.startDate ?? unique.map(o => o.details.validFrom).sort()[0];
      if (unique.length) localStorage.setItem('recipeai-offers-ready', firstDay < localDateInput() ? localDateInput() : firstDay);
      else localStorage.removeItem('recipeai-offers-ready');
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  if (!available) return null;
  return <section className="mb-6 space-y-3">
    <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40">{busy ? (pl ? 'Pobieranie promocji…' : 'Loading offers…') : (pl ? 'Pobierz promocje' : 'Load offers')}</button>
    {error && <p role="alert">{sourceStatus === 'LIVE_LEAFLET_REVIEW_REQUIRED'
      ? (pl ? 'Gazetka zmieniła się i wymaga sprawdzenia. Pokazujemy dostępne zapisane ceny.' : 'The leaflet changed and needs review. Available saved prices are shown.')
      : (pl ? 'Nie udało się pobrać promocji. Spróbuj ponownie. Dostępne zapisane ceny pozostają widoczne.' : 'Could not load offers. Try again. Available saved prices remain visible.')}</p>}
    {offers && <>
      <p role="status">{offers.length ? (pl ? `Dostępne produkty z obsługiwaną ceną: ${productCount}. Wybierz w tygodniu dni i posiłki.` : `${productCount} products with supported prices available. Choose days and meals in your week.`) : (pl ? 'Brak aktualnych promocji. Nadal możesz zaplanować posiłki.' : 'No current offers. You can still plan meals.')}</p>
      {summary ? <div className="space-y-2 rounded-lg bg-primary/5 p-3 text-sm" aria-label={pl ? 'Wynik importu gazetki' : 'Leaflet import result'}>
        <p>{pl ? `Gazetka Lidla ${summary.title}: odczytano ${summary.pages} stron, sprawdzono ${summary.reviewedCandidates} ofert. Do planera dopuszczono ${summary.products} produktów.` : `Lidl leaflet ${summary.title}: ${summary.pages} pages read, ${summary.reviewedCandidates} offers reviewed. ${summary.products} products accepted for planning.`}</p>
        <p>{pl ? 'Planer korzysta ze sprawdzonych składników. Pomijamy powtórzenia, artykuły poza zakresem posiłków oraz oferty bez jednoznacznych warunków. Dostępność zależy od daty zakupów, aplikacji i potwierdzonych kuponów.' : 'The planner uses reviewed ingredients. Duplicates, non-meal items and offers with unclear conditions are excluded. Availability depends on shopping date, loyalty card and confirmed coupons.'}</p>
        <details><summary className="cursor-pointer py-2">{pl ? 'Szczegóły pobierania' : 'Import details'}</summary>
          <p>{pl ? 'Czas importu' : 'Import time'}: {summary.importSeconds.toFixed(2)} s · {pl ? 'Koszt API' : 'API cost'}: {summary.paidApiCostUsd} USD</p>
          <ul>{Object.entries(summary.excludedReasons).map(([reason, count]) => <li key={reason}>{reasonLabel(reason, pl)}: {count}</li>)}</ul>
        </details>
        <a className="underline" href={summary.sourceUrl} target="_blank" rel="noopener noreferrer">{pl ? 'Otwórz gazetkę źródłową' : 'Open source leaflet'}</a>
      </div> : <p className="text-sm text-primary/70">{pl ? 'To część oferty Lidla, nie pełna gazetka. Część produktów i warunków promocji nie jest jeszcze obsługiwana.' : 'This is part of Lidl’s offers, not the full leaflet. Some products and promotional conditions are not supported yet.'} <a className="underline" href="https://www.lidl.pl/c/nasze-gazetki/s10008614" target="_blank" rel="noopener noreferrer">{pl ? 'Zobacz pełne gazetki Lidla' : 'View Lidl’s full leaflets'}</a></p>}
      <Link className="inline-block py-2 font-semibold underline" to="/MealPlanner?new=1">{pl ? 'Mój tydzień' : 'My week'}</Link>
      {offers.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3">{pl ? `Zobacz promocje (${productCount})` : `View offers (${productCount})`}</summary><ul className="grid gap-2 sm:grid-cols-2">{[...groups.values()].map(variants => {
        const unitCost = (o: CatalogOffer) => o.details.packagePrice ?? (o.details.bundlePrice ?? 0) / (o.details.bundleSize ?? 1);
        const o = [...variants].sort((a,b) => unitCost(a) - unitCost(b))[0];
        const money = (value: number) => new Intl.NumberFormat(locale, {style:'currency',currency:'PLN'}).format(value);
        return <li key={o.id} className="rounded-lg bg-primary/5 p-3 text-sm"><strong>{o.details.productName}</strong><p>{o.details.packageAmount} {o.details.unit} · {o.details.packagePrice == null ? `${money(o.details.bundlePrice!)} / ${o.details.bundleSize} ${pl ? 'szt.' : 'items'}` : money(o.details.packagePrice)}</p><p>{o.details.validFrom} – {o.details.validTo}</p><p>{o.details.conditions}</p><a className="underline" href={o.details.sourceUrl} target="_blank" rel="noopener noreferrer">{pl ? 'Źródło oferty' : 'Offer source'}</a></li>;
      })}</ul></details>}
    </>}
  </section>;
}

function reasonLabel(reason: string, pl: boolean) {
  const labels: Record<string, [string, string]> = {
    REPEATED_PRODUCT_OR_SECOND_PRICE_LABEL: ['Powtórzenia i dodatkowe etykiety cen', 'Duplicates and additional price labels'],
    UNKNOWN_PACK_WEIGHT_OR_OPEN_ENDED_VALIDITY: ['Nieznana masa opakowania lub brak daty końca', 'Unknown pack weight or end date'],
    OUTSIDE_MEAL_INGREDIENT_SCOPE: ['Poza zakresem składników do posiłków', 'Outside meal ingredient scope'],
    NO_EXPLICIT_VALIDITY_END_OR_UNAMBIGUOUS_PACK: ['Brak jednoznacznego okresu lub opakowania', 'Unclear validity or packaging'],
    NON_FOOD: ['Artykuły niespożywcze', 'Non-food items'],
    DIFFERENT_INGREDIENT_VARIANTS_SHARE_ONE_PRICE: ['Różne składniki pod wspólną ceną', 'Different ingredients sharing a price'],
    REGIONAL_AVAILABILITY: ['Oferty regionalne', 'Regional offers'],
    FLAVOURED_SNACK_NOT_GENERIC_MEAL_INGREDIENT: ['Przekąski smakowe', 'Flavoured snacks'],
  };
  return labels[reason]?.[pl ? 0 : 1] ?? (pl ? 'Pozostałe niesprawdzone warunki' : 'Other unreviewed conditions');
}
