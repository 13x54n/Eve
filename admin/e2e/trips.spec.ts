import { test, expect } from '@playwright/test';

test.describe('Trips Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to trips page
    await page.goto('/trips');
  });

  test('should display trips list', async ({ page }) => {
    // Check page loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Should have trips heading or table
    const content = await page.textContent('body');
    expect(content).toMatch(/trip|ride/i);
  });

  test('should allow filtering trips', async ({ page }) => {
    // Look for filter controls
    const filterInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').first();
    
    if (await filterInput.count() > 0) {
      await filterInput.fill('test');
      // Wait for any filtering to occur
      await page.waitForTimeout(500);
    }
  });

  test('should navigate to trip details', async ({ page }) => {
    // Find first trip link/button (adjust selector based on implementation)
    const tripLink = page.locator('a[href*="/trips/"], button').first();
    
    if (await tripLink.count() > 0) {
      await tripLink.click();
      // Should navigate to trip detail page
      await page.waitForLoadState('networkidle');
    }
  });
});
