/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useUser } from './context';
import { apiClient } from '../lib/hooks';

// Standalone components may be rendered without the application provider (e.g. tests).
const OffersAccessContext = createContext(true);
export const useOffersAccess = () => useContext(OffersAccessContext);
export function OffersAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const email = user?.email;
  const admin = user?.role === 'ADMIN';
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!email) { setAvailable(false); return; }
      if (admin) { setAvailable(true); return; }
      void apiClient<{ available: boolean }>('v2/offers/access').then(result => {
        if (!active) return;
        setAvailable(result.available === true);
        if (!result.available) localStorage.removeItem('recipeai-offers-ready');
      }).catch(() => { if (active) setAvailable(false); });
    };
    const storage = (event: StorageEvent) => { if (event.key === 'recipeai-offers-access-change') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('offers-access-changed', refresh);
    window.addEventListener('storage', storage);
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('offers-access-changed', refresh); window.removeEventListener('storage', storage); };
  }, [email, admin]);
  return <OffersAccessContext.Provider value={Boolean(email) && (admin || available)}>{children}</OffersAccessContext.Provider>;
}
