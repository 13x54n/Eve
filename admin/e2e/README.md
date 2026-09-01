# Admin Console E2E Tests

End-to-end tests for the Eve Admin Console using Playwright.

## Setup

1. Install dependencies:
```bash
npm install
npx playwright install
```

2. Make sure the backend is running on port 4000 with test data
3. Admin console will be started automatically by Playwright

## Running Tests

### All tests
```bash
npm run test:e2e
```

### Interactive UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Headed mode (see the browser)
```bash
npm run test:e2e:headed
```

### View test report
```bash
npm run test:e2e:report
```

## Test Structure

- `auth.setup.ts` - Authentication setup for all tests
- `dashboard.spec.ts` - Dashboard page tests
- `trips.spec.ts` - Trips management tests

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Import test utilities: `import { test, expect } from '@playwright/test'`
3. Follow the pattern in existing tests

## CI/CD

Tests run automatically in CI on pull requests. See `.github/workflows/test.yml`.

## Configuration

See `playwright.config.ts` for test configuration including:
- Browser targets (Chrome, Firefox, Safari)
- Viewport sizes
- Screenshot/video settings
- Retry logic
