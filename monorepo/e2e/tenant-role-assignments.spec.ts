import { expect, test, type Page } from '@playwright/test';

import { e2e } from './fixtures';

async function signIn(page: Page, email: string) {
  await page.goto(`/${e2e.alpha.domain}/login`);

  await expect(
    page.getByRole('heading', { name: `Masuk ke ${e2e.alpha.name}` }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata Sandi').fill(e2e.password);
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return form && Object.keys(form).some((key) => key.startsWith('__reactProps'));
  });
  await page.getByRole('button', { name: 'Masuk' }).click();
}

async function loginAsSchoolAdmin(page: Page) {
  await signIn(page, e2e.alpha.adminEmail);

  await expect(page).toHaveURL(
    new RegExp(
      `^https?://${e2e.alpha.domain}\\.localhost(?::\\d+)?/dashboard(?:[/?#]|$)`,
    ),
    { timeout: 90_000 },
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'Ringkasan' }),
  ).toBeVisible();
}

test('School Admin can log in to the Tenant dashboard', async ({ page }) => {
  await loginAsSchoolAdmin(page);
});

test('School Admin sees same-tenant non-admin accounts and overlapping effective access sources', async ({ page }) => {
  await loginAsSchoolAdmin(page);
  const response = await page.goto(`/${e2e.alpha.domain}/settings/assignments`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Assignment role' })).toBeVisible();
  await expect(page.getByText('Alpha Staff')).toBeVisible();
  await expect(page.getByText('Alpha School Admin')).toHaveCount(0);

  await page.getByRole('button', { name: /Alpha Staff/ }).click();
  await expect(page.getByRole('heading', { name: 'Akses efektif saat ini' })).toBeVisible();
  await expect(page.getByText('Sumber: Staf Operasional, Pembaca Dashboard')).toBeVisible();

  const stalePage = await page.context().newPage();
  await stalePage.goto(`/${e2e.alpha.domain}/settings/assignments`);
  await stalePage.getByRole('button', { name: /Alpha Staff/ }).click();
  await expect(stalePage.getByRole('heading', { name: 'Akses efektif saat ini' })).toBeVisible();

  const rolePanel = page.getByRole('group', { name: 'Role aktif' });
  await rolePanel.getByLabel('Staf Operasional').click();
  await rolePanel.getByLabel('Pembaca Dashboard').click();
  await expect(page.getByText('Akses belum diberikan', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan assignment' })).toBeDisabled();
  await page.getByLabel('Alasan perubahan').fill('Akun sedang menunggu penugasan baru');
  await page.getByText('Saya memahami pengguna akan memiliki nol role.').click();
  await page.getByRole('button', { name: 'Simpan assignment' }).click();
  await expect(page.getByText('Assignment role berhasil diperbarui.')).toBeVisible();

  const staleRolePanel = stalePage.getByRole('group', { name: 'Role aktif' });
  await staleRolePanel.getByLabel('Staf Operasional').click();
  await stalePage.getByRole('button', { name: 'Simpan assignment' }).click();
  await expect(stalePage.getByText('Data assignment sudah berubah. Muat ulang data pengguna lalu coba lagi.')).toBeVisible();
  await stalePage.close();

  await page.getByLabel('Pilih Alpha Staff untuk bulk').click();
  const bulkCard = page.getByText('Bulk assignment').locator('xpath=ancestor::div[@data-slot="card"]');
  await bulkCard.getByLabel('Staf Operasional').click();
  await bulkCard.getByPlaceholder('Alasan perubahan bulk (wajib)').fill('Penugasan operasional baru');
  await bulkCard.getByRole('button', { name: 'Preview perubahan' }).click();
  await expect(page.getByRole('heading', { name: 'Preview bulk assignment' })).toBeVisible();
  await page.getByRole('button', { name: 'Terapkan perubahan' }).click();
  await expect(page.getByText('1 assignment pengguna diproses.')).toBeVisible();
});

test('non-admin cannot open the assignment workspace directly', async ({ page }) => {
  await page.goto(`/${e2e.alpha.domain}/login`);
  await page.getByLabel('Email').fill(e2e.alpha.staffEmail);
  await page.getByLabel('Kata Sandi').fill(e2e.password);
  await page.getByRole('button', { name: 'Masuk' }).click();

  const response = await page.goto(`/${e2e.alpha.domain}/settings/assignments`);

  expect(response?.status()).toBe(403);
  await expect(page.getByRole('heading', { name: 'Assignment role' })).toHaveCount(0);
});
