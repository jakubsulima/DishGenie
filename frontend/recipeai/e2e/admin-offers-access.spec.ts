import { test, expect } from '@playwright/test';
import { mockShoppingListApi } from './apiMocks';

test('disabled promotions are hidden for a regular user while practical planning remains', async ({ page }) => {
  await mockShoppingListApi(page);
  await page.route('**/api/v2/offers/access', r => r.fulfill({ json: { available: false } }));
  await page.goto('/ShoppingList');
  await expect(page.getByRole('heading', { name: 'Shopping List', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load offers', exact: true })).toHaveCount(0);
  await page.goto('/MealPlanner?new=1');
  await page.getByText('Customize', { exact: true }).click();
  await expect(page.getByLabel('Planning style')).toHaveValue('PRACTICAL');
  await expect(page.getByRole('option', { name: 'Plan from promotions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Plan the week', exact: true })).toBeEnabled();
});

test('admin can disable user access and retain the importer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 950 });
  await mockShoppingListApi(page);
  await page.route('**/api/me', r => r.fulfill({ json: { id: 1, email: 'admin@example.test', role: 'ADMIN' } }));
  await page.route('**/api/admin/users?*', r => r.fulfill({ json: { content: [], totalPages: 1, totalElements: 0 } }));
  let setting = { version: 1, enabledForUsers: true, updatedAt: null, updatedBy: null };
  await page.route('**/api/admin/features/store-offers', async r => {
    if (r.request().method() === 'PUT') {
      expect(r.request().postDataJSON()).toEqual({ version: 1, enabledForUsers: false });
      setting = { ...setting, version: 2, enabledForUsers: false };
    }
    await r.fulfill({ json: setting });
  });
  await page.goto('/admin');
  const toggle = page.getByRole('switch', { name: 'Enable promotions for users' });
  await expect(toggle).toBeChecked(); await toggle.click();
  await expect(page.getByRole('status')).toHaveText('Promotion access saved.');
  await expect(toggle).not.toBeChecked();
  await page.screenshot({ path: '/tmp/recipeai-admin-offers-access.png' });
  await page.goto('/ShoppingList');
  await expect(page.getByRole('button', { name: 'Load offers', exact: true })).toBeEnabled();
});
