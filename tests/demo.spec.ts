import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const LOCAL_ORIGIN = 'http://127.0.0.1:4103'

/** Collect every request the page makes so we can prove nothing leaves the machine. */
function trackRequests(page: Page): string[] {
  const requests: string[] = []
  page.on('request', (request) => {
    requests.push(request.url())
  })
  return requests
}

function isLocal(url: string): boolean {
  return url.startsWith(LOCAL_ORIGIN) || url.startsWith('data:') || url.startsWith('blob:')
}

async function selectStep(page: Page, step: string): Promise<void> {
  await page.getByTestId(`step-${step}`).click()
  await expect(page.getByTestId('step-panel')).toBeVisible()
}

test.describe('Assembly Transform Lab', () => {
  test('shows the synthetic data notice and the two raw source tables', async ({ page }) => {
    const requests = trackRequests(page)

    await page.goto('/')

    await expect(page).toHaveTitle(/Assembly Transform Lab/)
    await expect(page.getByRole('heading', { level: 1, name: 'Assembly Transform Lab' })).toBeVisible()
    await expect(page.getByTestId('synthetic-notice')).toContainText('Synthetic data only')

    await expect(page.getByTestId('raw-components-table').locator('tbody tr')).toHaveCount(6)
    await expect(page.getByTestId('raw-deployments-table').locator('tbody tr')).toHaveCount(5)
    await expect(page.getByTestId('raw-components-table')).toContainText('C-03')
    await expect(page.getByTestId('raw-deployments-table')).toContainText('D-104')

    await expect(page.getByTestId('stat-components')).toHaveText('6')
    await expect(page.getByTestId('stat-active')).toHaveText('5')
    await expect(page.getByTestId('stat-deployments')).toHaveText('5')
    await expect(page.getByTestId('stat-matched')).toHaveText('4')
    await expect(page.getByTestId('stat-unmatched')).toHaveText('1')

    expect(requests.length).toBeGreaterThan(0)
    expect(requests.filter((url) => !isLocal(url))).toEqual([])
  })

  test('moves through the four pipeline steps and shows the rows each step produces', async ({ page }) => {
    await page.goto('/')

    await selectStep(page, 'filter-active')
    await expect(page.getByTestId('filter-row')).toHaveCount(5)
    await expect(page.getByTestId('filter-table')).not.toContainText('C-03')

    await selectStep(page, 'normalise-units')
    await expect(page.getByTestId('normalise-row')).toHaveCount(5)
    const firstNormalised = page.getByTestId('normalise-row').first()
    await expect(firstNormalised.locator('td[data-field="lengthM"]')).toHaveText('1.2')
    await expect(firstNormalised).toContainText('120')

    await selectStep(page, 'join-deployments')
    await expect(page.getByTestId('join-row')).toHaveCount(5)
    await expect(
      page.locator('tr[data-testid="join-row"][data-deployment="D-104"] td[data-field="match"]'),
    ).toHaveText('unmatched')
    await expect(
      page.locator('tr[data-testid="join-row"][data-deployment="D-100"] td[data-field="componentCount"]'),
    ).toHaveText('2')

    await selectStep(page, 'aggregate-assemblies')
    await expect(page.getByTestId('aggregate-row')).toHaveCount(4)
    const ax1 = page.locator('tr[data-testid="aggregate-row"][data-assembly="AX-1"]')
    await expect(ax1.locator('td[data-field="componentCount"]')).toHaveText('2')
    await expect(ax1.locator('td[data-field="totalLength"]')).toHaveText('2.0 m')
    await expect(ax1.locator('td[data-field="totalWeight"]')).toHaveText('30 kg')
  })

  test('shows the matched components and the totals of a selected deployment', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('deployment-D-100').click()

    await expect(page.getByTestId('detail-component-count')).toHaveText('2')
    await expect(page.getByTestId('detail-total-length')).toHaveText('2.0 m')
    await expect(page.getByTestId('detail-total-weight')).toHaveText('30 kg')
    await expect(page.getByTestId('matched-components-table').locator('tbody tr')).toHaveCount(2)
    await expect(page.getByTestId('matched-components-table')).toContainText('C-01')
    await expect(page.getByTestId('matched-components-table')).toContainText('C-02')
    await expect(page.getByTestId('matched-components-table')).not.toContainText('C-03')
  })

  test('warns clearly when a deployment has no matching components', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('deployment-D-104').click()

    const warning = page.getByTestId('unmatched-warning')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('Unmatched deployment')
    await expect(warning).toContainText('ZZ-9')
    await expect(page.getByTestId('detail-component-count')).toHaveText('0')
    await expect(page.getByTestId('detail-total-length')).toHaveText('0.0 m')
    await expect(page.getByTestId('detail-total-weight')).toHaveText('0 kg')
  })

  test('toggles the unmatched deployment in and out of the final view', async ({ page }) => {
    await page.goto('/')
    await selectStep(page, 'aggregate-assemblies')

    await expect(page.getByTestId('include-unmatched')).toBeChecked()
    await expect(page.getByTestId('aggregate-row')).toHaveCount(4)
    await expect(page.getByTestId('aggregate-table')).toContainText('ZZ-9')
    await expect(page.getByTestId('aggregate-table')).toContainText('D-104')

    await page.getByTestId('include-unmatched').uncheck()

    await expect(page.getByTestId('aggregate-row')).toHaveCount(3)
    await expect(page.getByTestId('aggregate-table')).not.toContainText('ZZ-9')
    await expect(page.getByTestId('aggregate-table')).not.toContainText('D-104')
    await expect(page.getByTestId('stat-assemblies')).toHaveText('3')

    await page.getByTestId('include-unmatched').check()
    await expect(page.getByTestId('aggregate-row')).toHaveCount(4)
  })

  test('reruns without duplicating rows and resets the lab', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('run-pipeline').click()
    await expect(page.getByTestId('stat-runs')).toHaveText('1')
    await page.getByTestId('run-pipeline').click()
    await expect(page.getByTestId('stat-runs')).toHaveText('2')

    await expect(page.getByTestId('raw-component-row')).toHaveCount(6)
    await expect(page.getByTestId('raw-deployment-row')).toHaveCount(5)
    await selectStep(page, 'join-deployments')
    await expect(page.getByTestId('join-row')).toHaveCount(5)
    await selectStep(page, 'aggregate-assemblies')
    await expect(page.getByTestId('aggregate-row')).toHaveCount(4)

    await page.getByTestId('deployment-D-100').click()
    await page.getByTestId('reset-lab').click()
    await expect(page.getByTestId('stat-runs')).toHaveText('0')
    await expect(page.getByTestId('deployment-empty')).toBeVisible()
    await expect(page.getByTestId('include-unmatched')).toBeChecked()
    await expect(page.getByTestId('raw-components-table')).toBeVisible()
    await expect(page.getByTestId('stat-active')).toHaveText('5')
  })

  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/')
    await selectStep(page, 'aggregate-assemblies')
    await page.getByTestId('deployment-D-100').click()

    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    )

    expect(
      serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`),
    ).toEqual([])
  })

  test('does not overflow horizontally at 390px and makes no external request', async ({ page }) => {
    const requests = trackRequests(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await selectStep(page, 'aggregate-assemblies')
    await page.getByTestId('deployment-D-104').click()

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

    expect(requests.filter((url) => !isLocal(url))).toEqual([])
  })
})
