import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getOffers, refreshStorePrices, type CatalogOffer } from '../lib/planPricing';
import { localDateInput } from '../lib/mealPlans';
import { useLanguage } from '../context/languageContext';

export default function ShoppingOffers() {
  const { locale } = useLanguage();
  const pl = locale === 'pl';
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<CatalogOffer[] | null>(null);
  const [error, setError] = useState(false);
  async function load() {
    setBusy(true); setError(false);
    try {
      await refreshStorePrices();
      const days = await Promise.all(Array.from({ length: 7 }, (_, i) => getOffers(['LIDL'], localDateInput(i))));
      const unique = [...new Map(days.flatMap(day => day.offers).map(offer => [offer.id, offer])).values()];
      setOffers(unique);
      if (unique.length) localStorage.setItem('recipeai-offers-ready', unique.map(o => o.details.validFrom).sort()[0] < localDateInput() ? localDateInput() : unique.map(o => o.details.validFrom).sort()[0]);
      else localStorage.removeItem('recipeai-offers-ready');
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 space-y-3">
    <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40">{busy ? (pl ? 'Pobieranie promocji…' : 'Loading offers…') : (pl ? 'Pobierz promocje' : 'Load offers')}</button>
    {error && <p role="alert">{pl ? 'Nie udało się pobrać promocji. Spróbuj ponownie.' : 'Could not load offers. Try again.'}</p>}
    {offers && <>
      <p role="status">{offers.length ? (pl ? `Dostępne produkty: ${offers.length}. Wybierz w tygodniu dni i posiłki.` : `${offers.length} products available. Choose days and meals in your week.`) : (pl ? 'Brak aktualnych promocji. Nadal możesz zaplanować posiłki.' : 'No current offers. You can still plan meals.')}</p>
      <Link className="inline-block py-2 font-semibold underline" to="/MealPlanner?new=1">{pl ? 'Mój tydzień' : 'My week'}</Link>
      {offers.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3">{pl ? `Zobacz promocje (${offers.length})` : `View offers (${offers.length})`}</summary><ul className="grid gap-2 sm:grid-cols-2">{offers.map(o => <li key={o.id} className="rounded-lg bg-primary/5 p-3 text-sm"><strong>{o.details.productName}</strong><p>{o.details.packageAmount} {o.details.unit} · {o.details.packagePrice == null ? (pl ? 'Cena zależna od warunków' : 'Conditional price') : new Intl.NumberFormat(locale, {style:'currency',currency:'PLN'}).format(o.details.packagePrice)}</p><p>{o.details.validFrom} – {o.details.validTo}</p><p>{o.details.conditions}</p></li>)}</ul></details>}
    </>}
  </section>;
}
