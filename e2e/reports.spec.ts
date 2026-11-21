import { expect, test } from '@playwright/test'
import { mockApi, P1, signIn } from './mockApi.ts'

const CIB = 'a0000000-0000-4000-8000-000000000001'

const answer = (path: string) => {
  if (path.endsWith('/rpc/bank_summaries')) {
    return [
      {
        id: CIB,
        name: 'CIB',
        logo: null,
        opening_balance: 0,
        income: 5000,
        expenses: 0,
        transfers_in: 10000,
        transfers_out: 0,
      },
    ]
  }
  if (path.endsWith('/rpc/bank_movements')) {
    return [
      {
        id: 'm1',
        seq: 1,
        kind: 'income',
        entry_date: '2026-11-01',
        category: 'دفعة',
        item: null,
        notes: null,
        amount: 5000,
        project_id: P1,
        project_name: 'فرش الحج مبروك',
        contractor: null,
      },
      {
        id: 't1',
        seq: null,
        kind: 'transfer_in',
        entry_date: '2026-11-17',
        category: 'تحويل بين بنوك',
        item: 'تحويل من Al Ahly',
        notes: null,
        amount: 10000,
        project_id: null,
        project_name: 'تحويل بين بنوك',
        contractor: null,
      },
    ]
  }
  return undefined
}

test('a bank statement adds a transfer into the bank (it must not take it away)', async ({ page }) => {
  await mockApi(page, { answer })
  await signIn(page)
  await page.goto('/#/reports')
  await page.getByLabel('نوع التقرير').selectOption({ label: 'كشف حساب بنك' })
  await page.getByRole('textbox', { name: 'البنك', exact: true }).click()
  await page.getByRole('option', { name: 'CIB' }).click()
  await page.getByRole('button', { name: 'عرض التقرير' }).click()
  // 5,000 income + 10,000 transferred in = 15,000 (the old statement showed -5,000)
  await expect(page.getByText('الرصيد الختامي')).toBeVisible()
  await expect(page.getByText('15,000').first()).toBeVisible()
  await expect(page.getByText('-5,000')).toHaveCount(0)
})

test('a project report is not asked for until a project is chosen', async ({ page }) => {
  await mockApi(page)
  await signIn(page)
  await page.goto('/#/reports')
  await page.getByLabel('نوع التقرير').selectOption({ label: 'تقرير مشروع' })
  await expect(page.getByRole('button', { name: 'عرض التقرير' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'المشروع', exact: true }).click()
  await page.getByRole('option', { name: 'فرش الحج مبروك' }).click()
  await expect(page.getByRole('button', { name: 'عرض التقرير' })).toBeEnabled()
})
