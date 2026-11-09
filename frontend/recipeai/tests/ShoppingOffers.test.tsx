import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import ShoppingOffers from '../src/components/ShoppingOffers';
import { LanguageProvider } from '../src/context/languageContext';
import { getOffers, refreshStorePrices } from '../src/lib/planPricing';
vi.mock('../src/lib/planPricing', () => ({ getOffers: vi.fn().mockResolvedValue({offers:[]}), refreshStorePrices: vi.fn().mockResolvedValue({}) }));
test('one load action and empty offers still permit planning', async () => {
 render(<LanguageProvider initialLocale="pl"><MemoryRouter><ShoppingOffers /></MemoryRouter></LanguageProvider>);
 expect(screen.getAllByRole('button')).toHaveLength(1);
 expect(refreshStorePrices).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', {name:'Pobierz promocje'}));
 expect(await screen.findByText('Brak aktualnych promocji. Nadal możesz zaplanować posiłki.')).toBeVisible();
 expect(refreshStorePrices).toHaveBeenCalledTimes(1);
 expect(getOffers).toHaveBeenCalledTimes(7);
 expect(screen.getByRole('link',{name:'Mój tydzień'})).toHaveAttribute('href','/MealPlanner?new=1');
});
