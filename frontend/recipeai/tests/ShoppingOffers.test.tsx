import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import ShoppingOffers from '../src/components/ShoppingOffers';
import { LanguageProvider } from '../src/context/languageContext';
import { getOffers, refreshStorePrices } from '../src/lib/planPricing';
import type { CatalogOffer } from '../src/lib/planPricing';
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
test('shows the complete leaflet import result and exact bundle price without duplicate product cards', async () => {
 const details: CatalogOffer['details'] = { store:'LIDL',productName:'Kaki',packageAmount:1,unit:'pcs',packagePrice:null,bundlePrice:4.99,bundleSize:2,minimumPackages:2,packageMultiple:2,maximumPackages:6,loyaltyRequired:true,couponRequired:true,validFrom:'2026-11-12',validTo:'2026-11-14',sourceUrl:'https://www.lidl.pl/l/pl/gazetki/gazetka-12-11-czw-kw46/ar/0',conditions:'1+1 gratis. Wymagana aktywacja kuponu.',verifiedAt:'2026-11-11T12:00:00Z' };
 vi.mocked(getOffers).mockResolvedValue({sourceStatus:'LIVE_LEAFLET_REVIEWED',importSummary:{title:'12.11',sourceUrl:details.sourceUrl,pdfSha256:'source',pages:97,candidates:313,reviewedCandidates:313,products:50,priceVariants:85,excludedReasons:{REGIONAL_AVAILABILITY:7},importSeconds:5.4,paidApiCostUsd:'0.00',cacheHit:false},offers:[
  {id:'bundle',version:0,details}, {id:'regular',version:0,details:{...details,packagePrice:4.99,bundlePrice:null,bundleSize:null}},
 ]});
 render(<LanguageProvider initialLocale="pl"><MemoryRouter><ShoppingOffers /></MemoryRouter></LanguageProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Pobierz promocje'}));
 expect(await screen.findByLabelText('Wynik importu gazetki')).toHaveTextContent('odczytano 97 stron, sprawdzono 313 ofert');
 expect(screen.getByText(/Do planera dopuszczono 50 produktów/)).toBeVisible();
 expect(screen.getByText('Zobacz promocje (1)')).toBeVisible();
 fireEvent.click(screen.getByText('Zobacz promocje (1)'));
 expect(screen.getAllByText('Kaki')).toHaveLength(1);
 expect(screen.getByText(/4,99.*2 szt/)).toBeVisible();
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('changed leaflet reports the review requirement instead of claiming a successful refresh', async () => {
 vi.mocked(getOffers).mockResolvedValue({sourceStatus:'LIVE_LEAFLET_REVIEW_REQUIRED',offers:[]});
 render(<LanguageProvider initialLocale="pl"><MemoryRouter><ShoppingOffers /></MemoryRouter></LanguageProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Pobierz promocje'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Gazetka zmieniła się i wymaga sprawdzenia');
});
test('counts products rather than price variants and identifies partial coverage', async () => {
 const details: CatalogOffer['details'] = { store:'LIDL',productName:'Masło',packageAmount:200,unit:'g',packagePrice:4.99,minimumPackages:1,packageMultiple:1,maximumPackages:null,loyaltyRequired:false,validFrom:'2026-11-12',validTo:'2026-11-14',sourceUrl:'https://www.lidl.pl/p/maslo/p1',conditions:'Cena regularna',verifiedAt:'2026-11-11T12:00:00Z' };
 vi.mocked(getOffers).mockResolvedValue({sourceStatus:'LIVE_PARTIAL',offers:[
  {id:'regular',version:0,details},
  {id:'coupon',version:0,details:{...details,packagePrice:2.49,loyaltyRequired:true}},
  {id:'cabbage',version:0,details:{...details,productName:'Kapusta stożkowa',sourceUrl:'https://www.lidl.pl/p/kapusta/p2'}},
 ]});
 render(<LanguageProvider initialLocale="pl"><MemoryRouter><ShoppingOffers /></MemoryRouter></LanguageProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Pobierz promocje'}));
 expect(await screen.findByText('Dostępne produkty z obsługiwaną ceną: 2. Wybierz w tygodniu dni i posiłki.')).toBeVisible();
 expect(screen.getByText(/To część oferty Lidla, nie pełna gazetka/)).toBeVisible();
 expect(screen.getByRole('link',{name:'Zobacz pełne gazetki Lidla'})).toHaveAttribute('href','https://www.lidl.pl/c/nasze-gazetki/s10008614');
});
