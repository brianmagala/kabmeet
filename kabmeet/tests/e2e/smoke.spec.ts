import { expect, test } from '@playwright/test';

const BASE_URL = process.env.KABMEET_BASE_URL ?? 'http://localhost:3000';

test.describe('Kabmeet Core End-to-End Smoke Suite', () => {
  test('Discover loads IndabaX sessions, filters by community, and switches theme', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('button', { name: /kabmeet/i })).toBeVisible();
    await expect(page.getByText(/Live sessions, rooms, and classes/i)).toBeVisible();

    const searchInput = page.getByLabel('Search sessions');
    await searchInput.fill('Python');
    await expect(page.getByText(/Applied Machine Learning/i)).toBeVisible();

    const themeBtn = page.getByRole('button', { name: /Switch to dark theme/i });
    await themeBtn.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('Visitor cannot access Host Panel or Admin Console directly', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/admin/overview`);
    expect(res.status()).toBe(401);
  });

  test('Member registration forces MEMBER role server-side', async ({ page }) => {
    const uniqueEmail = `smoke.${Date.now()}@kab.ac.ug`;
    const res = await page.request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: uniqueEmail,
        fullName: 'Smoke Student',
        password: 'KabmeetTestPassword123',
        role: 'ADMIN',
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { user: { role: string } };
    expect(body.user.role).toBe('MEMBER');
  });
});
