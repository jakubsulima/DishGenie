import { useEffect, useState } from 'react';
import { apiClient, putClient } from '../lib/hooks';
import { useLanguage } from '../context/languageContext';

interface Setting { version: number; enabledForUsers: boolean; updatedAt: string | null; updatedBy: string | null }
export default function AdminOffersAccess() {
  const { locale } = useLanguage(); const pl = locale === 'pl';
  const [setting, setSetting] = useState<Setting | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void apiClient<Setting>('admin/features/store-offers').then(value => { if (active) setSetting(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const change = async (enabledForUsers: boolean) => {
    if (!setting || busy) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      const value = await putClient('admin/features/store-offers', { version: setting.version, enabledForUsers }) as Setting;
      setSetting(value); setSaved(true);
      localStorage.setItem('recipeai-offers-access-change', String(Date.now()));
      window.dispatchEvent(new Event('offers-access-changed'));
    } catch {
      setError(true);
      try { setSetting(await apiClient<Setting>('admin/features/store-offers')); } catch { setSetting(null); }
    } finally { setBusy(false); }
  };
  return <section className="mb-8 space-y-3 rounded-xl border border-primary/20 p-4" aria-label={pl ? 'Dostęp do promocji' : 'Promotion access'}>
    <h2 className="text-xl font-semibold">{pl ? 'Promocje z gazetek' : 'Leaflet promotions'}</h2>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" role="switch" disabled={busy || !setting} checked={setting?.enabledForUsers ?? false} onChange={e => void change(e.target.checked)} />{pl ? 'Udostępniaj promocje użytkownikom' : 'Enable promotions for users'}</label>
    <p className="text-sm text-primary/75">{pl ? 'Po wyłączeniu tylko administratorzy mogą pobierać promocje i korzystać z nich w planerze. Zwykły planer i ceny wpisane ręcznie nadal działają. Ustawienie obowiązuje wszystkich użytkowników i jest zapamiętywane po restarcie.' : 'When disabled, only administrators can fetch promotions and use them in the planner. Practical planning and manually entered prices remain available. This setting applies to all users and survives restarts.'}</p>
    {saved && <p role="status">{pl ? 'Zapisano dostęp do promocji.' : 'Promotion access saved.'}</p>}
    {error && <p role="alert">{pl ? 'Nie udało się zmienić dostępu. Odśwież panel i spróbuj ponownie.' : 'Could not change access. Reload the panel and try again.'}</p>}
  </section>;
}
