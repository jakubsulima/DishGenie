import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OffersAccessProvider } from '../src/context/offersAccessContext';
import { LanguageProvider } from '../src/context/languageContext';
import ShoppingOffers from '../src/components/ShoppingOffers';
import { apiClient } from '../src/lib/hooks';
import { useUser } from '../src/context/context';
vi.mock('../src/lib/hooks', () => ({ apiClient: vi.fn() }));
vi.mock('../src/context/context', () => ({ useUser: vi.fn() }));
beforeEach(() => {
 vi.mocked(useUser).mockReturnValue({ user: { id: 1, email: 'user@example.test', role: 'USER' }, loading: false, setUser: vi.fn(), isAdmin: false, getUserPreferences: vi.fn(), refreshSession: vi.fn(), logout: vi.fn() });
});
const app = () => render(<LanguageProvider initialLocale="pl"><MemoryRouter><OffersAccessProvider><ShoppingOffers /></OffersAccessProvider></MemoryRouter></LanguageProvider>);
test('disabled feature hides loading controls and clears remembered promotion intent', async () => {
 localStorage.setItem('recipeai-offers-ready', '2026-11-12');
 vi.mocked(apiClient).mockResolvedValue({ available: false }); app();
 await waitFor(() => expect(localStorage.getItem('recipeai-offers-ready')).toBeNull());
 expect(screen.queryByRole('button', { name: 'Pobierz promocje' })).not.toBeInTheDocument();
 expect(apiClient).toHaveBeenCalledWith('v2/offers/access');
});
test('administrator keeps the importer without relying on the public feature flag', async () => {
 vi.mocked(useUser).mockReturnValue({ ...useUser(), user: { id: 2, email: 'admin@example.test', role: 'ADMIN' }, isAdmin: true });
 app(); expect(await screen.findByRole('button', { name: 'Pobierz promocje' })).toBeEnabled();
});
