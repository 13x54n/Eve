# Testing Standards for Eve Platform

## Overview

This document defines testing standards, best practices, and guidelines for the Eve platform across backend, mobile apps, and admin console.

## Testing Philosophy

1. **Test Behavior, Not Implementation**: Focus on what code does, not how it does it
2. **Write Tests First (TDD)**: When fixing bugs, write failing test first
3. **Keep Tests Fast**: Slow tests discourage running them
4. **Avoid Flaky Tests**: Tests should be deterministic
5. **Mock External Dependencies**: Don't rely on third-party services in tests

## Coverage Targets

### Backend
- **Statements**: 70% minimum
- **Branches**: 60% minimum
- **Functions**: 65% minimum
- **Lines**: 70% minimum

### Frontend (Rider/Driver/Admin)
- **Statements**: 60% minimum (initial target)
- **Branches**: 50% minimum
- **Functions**: 55% minimum
- **Lines**: 60% minimum

Critical paths (authentication, payments, trip lifecycle) should have >90% coverage.

## Test Types

### Unit Tests
Test individual functions and components in isolation.

**When to write:**
- Pure functions
- Utility functions
- React components
- Business logic

**Example:**
```typescript
describe('calculateFare', () => {
  it('should calculate base fare correctly', () => {
    const fare = calculateFare(5, 'CAR');
    expect(fare).toBeGreaterThan(0);
  });
});
```

### Integration Tests
Test how multiple units work together.

**When to write:**
- API endpoints
- Database operations
- Service interactions
- Auth flows

**Example:**
```typescript
describe('POST /api/rider/trips', () => {
  it('should create trip and return 201', async () => {
    const response = await request(app)
      .post('/api/rider/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(tripData);
    
    expect(response.status).toBe(201);
    expect(response.body.trip.id).toBeDefined();
  });
});
```

### E2E Tests
Test complete user workflows.

**When to write:**
- Critical user journeys
- Cross-system flows
- UI interactions

**Example:**
```typescript
test('rider can request and complete trip', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="pickup"]', 'Times Square');
  await page.fill('[data-testid="dropoff"]', 'Central Park');
  await page.click('[data-testid="request-ride"]');
  await expect(page.locator('[data-testid="trip-status"]')).toContainText('Searching');
});
```

### Contract Tests
Ensure API contracts remain stable.

**When to write:**
- REST API endpoints
- GraphQL schemas
- Mobile app API consumers

## Test Organization

### File Structure

```
backend/
  tests/
    *.test.ts           # Integration tests
    contracts/          # API contract tests
    helpers/            # Test utilities
  
rider/
  src/
    components/
      __tests__/        # Component tests
    __tests__/          # Feature tests
  
admin/
  e2e/                  # Playwright E2E tests
```

### Naming Conventions

- Test files: `*.test.ts` or `*.spec.ts`
- Test suites: `describe('ComponentName', () => {})`
- Test cases: `it('should do something', () => {})`

## Writing Good Tests

### AAA Pattern

Arrange, Act, Assert:

```typescript
it('should accept valid offer', async () => {
  // Arrange
  const trip = await createTrip();
  const offer = await createOffer(trip.id);
  
  // Act
  const result = await acceptOffer(offer.id);
  
  // Assert
  expect(result.trip.status).toBe('ASSIGNED');
});
```

### Test Isolation

Each test should be independent:

```typescript
beforeEach(async () => {
  await cleanupDatabase();
  testUser = await createTestUser();
});

afterEach(async () => {
  await cleanupTestData();
});
```

### Descriptive Names

```typescript
// Bad
it('test 1', () => {});

// Good
it('should return 404 when trip not found', () => {});
```

### Test One Thing

```typescript
// Bad - testing multiple concerns
it('should work', () => {
  expect(user.name).toBe('John');
  expect(user.email).toBe('john@example.com');
  expect(trip.status).toBe('COMPLETED');
});

// Good - separate tests
it('should set user name correctly', () => {
  expect(user.name).toBe('John');
});

it('should set user email correctly', () => {
  expect(user.email).toBe('john@example.com');
});
```

## Mocking

### Mock External Services

```typescript
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

mockedAxios.post.mockResolvedValueOnce({
  data: { success: true },
});
```

### Mock Auth0

```typescript
jest.mock('react-native-auth0', () => ({
  useAuth0: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    authorize: jest.fn(),
  }),
}));
```

### Mock Location

```typescript
jest.mock('expo-location', () => ({
  getCurrentPositionAsync: () =>
    Promise.resolve({
      coords: { latitude: 40.7128, longitude: -74.006 },
    }),
}));
```

## Testing Async Code

### Promises

```typescript
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Callbacks

```typescript
it('should call callback', (done) => {
  doSomething((result) => {
    expect(result).toBe(true);
    done();
  });
});
```

### Timers

```typescript
jest.useFakeTimers();

it('should debounce', () => {
  const fn = jest.fn();
  const debounced = debounce(fn, 100);
  
  debounced();
  debounced();
  debounced();
  
  jest.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
});
```

## Test Data

### Factories

```typescript
export function createMockTrip(overrides = {}) {
  return {
    id: 'trip-123',
    status: 'SEARCHING',
    riderId: 'rider-456',
    ...overrides,
  };
}
```

### Fixtures

```typescript
// fixtures/trips.json
{
  "validTrip": {
    "pickupLat": 40.7128,
    "pickupLng": -74.006,
    "dropoffLat": 40.758,
    "dropoffLng": -73.9855,
    "vehicleType": "CAR"
  }
}
```

## CI/CD Integration

Tests run automatically on every PR:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
  
- name: Upload coverage
  uses: codecov/codecov-action@v4
```

## Performance Testing

### Load Tests

```bash
# Run k6 load tests
npm run load:smoke
npm run load:capacity
```

### Benchmarks

```typescript
describe('Performance', () => {
  it('should calculate fare in under 10ms', () => {
    const start = performance.now();
    calculateFare(5, 'CAR');
    const end = performance.now();
    expect(end - start).toBeLessThan(10);
  });
});
```

## Common Pitfalls

### ❌ Don't

```typescript
// Testing implementation details
expect(component.state.count).toBe(5);

// Hardcoded waits
await new Promise(resolve => setTimeout(resolve, 5000));

// Shared mutable state
let user; // Shared across tests

// Testing private methods
expect(obj._privateMethod()).toBe(true);
```

### ✅ Do

```typescript
// Test behavior
expect(screen.getByText('Count: 5')).toBeInTheDocument();

// Use waitFor
await waitFor(() => expect(element).toBeVisible());

// Isolate tests
beforeEach(() => {
  user = createTestUser();
});

// Test public API
expect(obj.publicMethod()).toBe(true);
```

## Resources

- [Testing Library Documentation](https://testing-library.com/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)

## Questions?

Ask in #qa Slack channel or review with QA team lead.
