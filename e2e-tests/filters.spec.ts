import { test, expect, type Page } from '@playwright/test';

/** Counts the game cards currently visible on the page. */
async function visibleCardCount(page: Page): Promise<number> {
  return page.getByTestId('game-card').locator('visible=true').count();
}

test.describe('Game filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-filters')).toBeVisible();
  });

  test('filters games by category and clears the filter', async ({ page }) => {
    const total = await page.getByTestId('game-card').count();
    const checkbox = page.getByTestId('game-filters').locator('input[name="category"]').first();
    const categoryId = await checkbox.getAttribute('value');

    await test.step('Select a category', async () => {
      await checkbox.check({ force: true });
      const cards = page.locator(`[data-testid="game-card"][data-category-id="${categoryId}"]`);
      const matching = await cards.count();
      expect(matching).toBeGreaterThan(0);
      await expect.poll(() => visibleCardCount(page)).toBe(matching);
      await expect(page.getByTestId('filter-count')).toHaveText(`Showing ${matching} of ${total} games`);
      await expect(page).toHaveURL(new RegExp(`category=${categoryId}`));
    });

    await test.step('Clear filters', async () => {
      await page.getByTestId('filter-clear').click();
      await expect.poll(() => visibleCardCount(page)).toBe(total);
      await expect(page).not.toHaveURL(/category=/);
    });
  });

  test('combines category and publisher filters', async ({ page }) => {
    const firstCard = page.getByTestId('game-card').first();
    const categoryId = await firstCard.getAttribute('data-category-id');
    const publisherId = await firstCard.getAttribute('data-publisher-id');

    await page.getByTestId(`filter-category-${categoryId}`).check({ force: true });
    await page.getByTestId(`filter-publisher-${publisherId}`).check({ force: true });

    const expected = await page
      .locator(`[data-testid="game-card"][data-category-id="${categoryId}"][data-publisher-id="${publisherId}"]`)
      .count();
    await expect.poll(() => visibleCardCount(page)).toBe(expected);
  });

  test('supports multiple categories at once', async ({ page }) => {
    const boxes = page.getByTestId('game-filters').locator('input[name="category"]');
    const first = await boxes.nth(0).getAttribute('value');
    const second = await boxes.nth(1).getAttribute('value');

    await boxes.nth(0).check({ force: true });
    await boxes.nth(1).check({ force: true });

    const expected = await page
      .locator(`[data-testid="game-card"][data-category-id="${first}"], [data-testid="game-card"][data-category-id="${second}"]`)
      .count();
    await expect.poll(() => visibleCardCount(page)).toBe(expected);
  });

  test('shows a message when no games match', async ({ page }) => {
    // The seeded catalog covers every pair, so drop one pair's cards to simulate no matches.
    const firstCard = page.getByTestId('game-card').first();
    const categoryId = await firstCard.getAttribute('data-category-id');
    const publisherId = await firstCard.getAttribute('data-publisher-id');
    await page
      .locator(`[data-testid="game-card"][data-category-id="${categoryId}"][data-publisher-id="${publisherId}"]`)
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));

    await page.getByTestId(`filter-category-${categoryId}`).check({ force: true });
    await page.getByTestId(`filter-publisher-${publisherId}`).check({ force: true });
    await expect(page.getByTestId('empty-state-text')).toHaveText('No games match the selected filters.');
    await expect(page.getByTestId('games-grid')).toBeHidden();
  });

  test('restores filters from the URL', async ({ page }) => {
    const categoryId = await page.getByTestId('game-card').first().getAttribute('data-category-id');
    await page.goto(`/?category=${categoryId}`);
    await expect(page.getByTestId(`filter-category-${categoryId}`)).toBeChecked();
  });

  test('filters are operable with the keyboard', async ({ page }) => {
    const checkbox = page.getByTestId('game-filters').locator('input[name="category"]').first();
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(page.getByTestId('filter-count')).toContainText('Showing');
  });
});
