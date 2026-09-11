import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in login credentials
  // Using the seeded admin credentials from the README
  await page.fill('input[name="email"]', 'owner@eve.local');
  await page.fill('input[name="password"]', 'Admin123!');
  
  // Click login button
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard');
  
  // Verify we're logged in
  await expect(page.locator('body')).not.toContainText('Login');
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
});
