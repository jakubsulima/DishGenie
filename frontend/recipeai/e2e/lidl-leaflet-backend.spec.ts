import { test, expect } from '@playwright/test';

test.skip(!process.env.RECIPEAI_LEAFLET_BACKEND, 'Requires an isolated backend with the real full-leaflet importer enabled.');
test.use({ timezoneId: 'Europe/Warsaw' });

for (const width of [360, 390, 1440]) test(`imports the complete Lidl leaflet through the application at ${width}px`, async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width, height: 950 });
  await page.addInitScript(() => {
    localStorage.setItem('dishGenie.locale', 'pl');
    localStorage.setItem('isLoggedIn', 'true');
  });
  const csrf = await (await page.request.get('/api/csrf')).json();
  const cookie = (await page.context().cookies()).find(c => c.name === 'XSRF-TOKEN')!;
  const registered = await page.request.post('/api/register', {
    headers: { [csrf.headerName]: decodeURIComponent(cookie.value) },
    data: { email: `leaflet-${width}-${Date.now()}@example.test`, password: 'Leaflet-local-2026!', acceptedTerms: true, acceptedPrivacy: true },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await page.goto('/ShoppingList');
  const reload = page.waitForResponse(r => r.url().includes('/offers/reload-prices'), { timeout: 120_000 });
  await page.getByRole('button', { name: 'Pobierz promocje', exact: true }).click();
  const response = await reload;
  expect(response.ok(), await response.text()).toBe(true);
  expect((await response.json()).find((s: { store: string }) => s.store === 'LIDL').status).toBe('LIVE_LEAFLET_REVIEWED');
  const summary = page.getByLabel('Wynik importu gazetki');
  await expect(summary).toContainText('odczytano 97 stron, sprawdzono 313 ofert', { timeout: 120_000 });
  await expect(summary).toContainText('Do planera dopuszczono 50 produktów');
  await expect(page.getByRole('alert')).toHaveCount(0);
  const date = await page.evaluate(() => localStorage.getItem('recipeai-offers-ready'));
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const catalog = await page.request.get(`/api/v2/offers?stores=LIDL&shoppingDate=${date}`);
  expect(catalog.ok(), await catalog.text()).toBe(true);
  const data = await catalog.json();
  expect(data.sourceStatus).toBe('LIVE_LEAFLET_REVIEWED');
  expect(data.offers.some((offer: { ingredientKey: string }) => offer.ingredientKey === 'chicken-mince')).toBe(true);
  expect(data.offers.some((offer: { ingredientKey: string }) => offer.ingredientKey === 'split-peas')).toBe(true);
  const before = data.offers.map((offer: { id: string }) => offer.id).sort();
  await page.getByText('Szczegóły pobierania', { exact: true }).click();
  await expect(summary).toContainText('Koszt API: 0.00 USD');
  await page.getByText('Zobacz promocje (50)', { exact: true }).click();
  await expect(page.getByText('RZEŹNIK Mięso mielone z karkówki', { exact: true })).toBeVisible();
  await expect(page.getByText('KUCHNIA LIDLA Groch łuskany', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/lidl-leaflet-app-${width}.png` });
  await page.getByRole('button', { name: 'Pobierz promocje', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pobierz promocje', exact: true })).toBeEnabled();
  const again = await (await page.request.get(`/api/v2/offers?stores=LIDL&shoppingDate=${date}`)).json();
  expect(again.offers.map((offer: { id: string }) => offer.id).sort()).toEqual(before);
  await page.getByRole('link', { name: 'Mój tydzień', exact: true }).click();
  await expect(page.getByLabel('Data rozpoczęcia', { exact: true })).toHaveValue(date!);
});
