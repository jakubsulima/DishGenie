import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import AdminOffersAccess from '../src/components/AdminOffersAccess';
import { LanguageProvider } from '../src/context/languageContext';
import { apiClient, putClient } from '../src/lib/hooks';
vi.mock('../src/lib/hooks', () => ({ apiClient: vi.fn(), putClient: vi.fn() }));
const setting = { version: 3, enabledForUsers: true, updatedAt: null, updatedBy: null };
beforeEach(() => { vi.mocked(apiClient).mockResolvedValue(setting); vi.mocked(putClient).mockReset(); });
test('admin switch saves the current version and explains continued admin access', async () => {
 vi.mocked(putClient).mockResolvedValue({ ...setting, version: 4, enabledForUsers: false });
 render(<LanguageProvider initialLocale="pl"><AdminOffersAccess /></LanguageProvider>);
 const toggle = await screen.findByRole('switch', { name: 'Udostępniaj promocje użytkownikom' });
 await waitFor(() => expect(toggle).toBeEnabled()); expect(toggle).toBeChecked();
 fireEvent.click(toggle);
 expect(await screen.findByRole('status')).toHaveTextContent('Zapisano dostęp do promocji.');
 expect(putClient).toHaveBeenCalledWith('admin/features/store-offers', { version: 3, enabledForUsers: false });
 expect(toggle).not.toBeChecked();
 expect(screen.getByText(/tylko administratorzy mogą pobierać promocje/)).toBeVisible();
});
test('failed save reloads the persisted value instead of showing a successful toggle', async () => {
 vi.mocked(putClient).mockRejectedValue(new Error('conflict'));
 render(<LanguageProvider initialLocale="pl"><AdminOffersAccess /></LanguageProvider>);
 const toggle = await screen.findByRole('switch'); await waitFor(() => expect(toggle).toBeEnabled());
 fireEvent.click(toggle); expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zmienić dostępu');
 await waitFor(() => expect(toggle).toBeEnabled()); expect(toggle).toBeChecked();
 expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
