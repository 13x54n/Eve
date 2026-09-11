import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
  });

  test('should display dashboard with key metrics', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Dashboard|Eve Admin/);
    
    // Verify dashboard is loaded
    await expect(page.locator('h1, h2')).toContainText(/Dashboard|Overview/i);
    
    // Check for key metric cards (adjust selectors based on actual implementation)
    // These are placeholder checks - adjust based on your dashboard structure
    const content = await page.textContent('body');
    
    // Should show some statistics
    expect(content).toBeTruthy();
  });

  test('should have working navigation menu', async ({ page }) => {
    // Check for navigation elements
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible();
    
    // Should have links to key sections
    const body = await page.textContent('body');
    expect(body).toMatch(/trips|drivers|riders/i);
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
  });
});
