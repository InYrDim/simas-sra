import { expect, test, type Page } from '@playwright/test';

import { e2e } from './fixtures';

async function login(page: Page) {
  await page.goto(`/${e2e.alpha.domain}/login`);
  await page.getByLabel('Email').fill(e2e.alpha.adminEmail);
  await page.getByLabel('Kata Sandi').fill(e2e.password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(new RegExp(`/${e2e.alpha.domain}/`));
}

test('School Admin sees same-tenant non-admin accounts and overlapping effective access sources', async ({ page }) => {
  await login(page);
  const response = await page.goto(`/${e2e.alpha.domain}/settings/assignments`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Assignment role' })).toBeVisible();
  await expect(page.getByText('Alpha Staff')).toBeVisible();
  await expect(page.getByText('Alpha School Admin')).toHaveCount(0);

  await page.getByRole('button', { name: /Alpha Staff/ }).click();
  await expect(page.getByRole('heading', { name: 'Akses efektif saat ini' })).toBeVisible();
  await expect(page.getByText('Sumber: Staf Operasional, Pembaca Dashboard')).toBeVisible();

  const rolePanel = page.getByRole('group', { name: 'Role aktif' });
  await rolePanel.getByLabel('Staf Operasional').click();
  await rolePanel.getByLabel('Pembaca Dashboard').click();
  await expect(page.getByText('Akses belum diberikan', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan assignment' })).toBeDisabled();
  await page.getByLabel('Alasan perubahan').fill('Akun sedang menunggu penugasan baru');
  await page.getByText('Saya memahami pengguna akan memiliki nol role.').click();
  await page.getByRole('button', { name: 'Simpan assignment' }).click();
  await expect(page.getByText('Assignment role berhasil diperbarui.')).toBeVisible();
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
