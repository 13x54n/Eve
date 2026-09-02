# Development Workflow

This guide covers development practices, workflows, and standards for contributing to the Eve platform.

## Table of Contents

- [Getting Started](#getting-started)
- [Git Workflow](#git-workflow)
- [Code Standards](#code-standards)
- [Development Tools](#development-tools)
- [Testing Requirements](#testing-requirements)
- [Code Review Guidelines](#code-review-guidelines)
- [Debugging](#debugging)
- [Database Management](#database-management)
- [Common Tasks](#common-tasks)

## Getting Started

### Initial Setup

1. **Fork and clone** the repository
2. Follow [GETTING_STARTED.md](GETTING_STARTED.md) to set up your local environment
3. Install development tools (ESLint, Prettier, etc.)
4. Create a feature branch for your work

### Development Environment

```bash
# Development
cd backend
npm run dev  # Five services with hot reload

# Admin console (optional for alpha)
cd admin
npm run dev

# Mobile apps (requires development client build)
cd rider  # or driver
npx expo run:ios  # or run:android
npx expo start
```

## Git Workflow

### Branching Strategy

We use a **feature branch workflow** with the following conventions:

```
main                    # Production-ready code
  ├── feature/user-auth      # New features
  ├── fix/trip-bug           # Bug fixes
  ├── docs/api-guide         # Documentation
  └── refactor/clean-service # Code refactoring
```

### Branch Naming

Use descriptive, kebab-case names with category prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/driver-ratings` |
| `fix/` | Bug fixes | `fix/websocket-disconnect` |
| `refactor/` | Code refactoring | `refactor/auth-service` |
| `docs/` | Documentation | `docs/deployment-guide` |
| `test/` | Adding tests | `test/trip-lifecycle` |
| `chore/` | Maintenance | `chore/update-dependencies` |

### Creating a Feature Branch

```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/my-feature

# Work on your feature
git add .
git commit -m "Add my feature"

# Push to your fork
git push origin feature/my-feature
```

### Commit Messages

Follow the **Conventional Commits** specification:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```bash
# Good commit messages
git commit -m "feat(auth): add Auth0 integration"
git commit -m "fix(ride): prevent duplicate offers"
git commit -m "docs(api): update endpoint documentation"
git commit -m "test(location): add H3 matching tests"

# Bad commit messages (avoid these)
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "Update file.ts"
```

### Commit Often

Make small, focused commits:

```bash
# Bad: one huge commit
git add .
git commit -m "Implement entire trip system"

# Good: logical commits
git commit -m "feat(ride): add trip creation endpoint"
git commit -m "feat(ride): add offer submission"
git commit -m "feat(ride): add offer acceptance"
git commit -m "test(ride): add trip lifecycle tests"
```

### Pull Requests

1. **Before creating a PR**:
   ```bash
   # Update your branch with latest main
   git checkout main
   git pull origin main
   git checkout feature/my-feature
   git rebase main
   
   # Run tests
   cd backend && npm test
   cd admin && npm run lint
   
   # Run linting
   npm run lint
   ```

2. **Create PR** on GitHub with:
   - Clear title (follows commit convention)
   - Description of changes
   - Link to related issue
   - Screenshots/videos for UI changes
   - Checklist of completed tasks

3. **PR Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No new warnings
   ```

### Merge Strategy

- **Squash and merge** for feature branches (clean history)
- **Rebase and merge** for hotfixes (preserve commits)
- Delete branch after merge

## Code Standards

### TypeScript

All new code must be TypeScript with strict mode enabled.

```typescript
// Good: Explicit types
interface User {
  id: number;
  email: string;
  role: UserRole;
}

async function createUser(data: CreateUserInput): Promise<User> {
  // Implementation
}

// Bad: Any types
function createUser(data: any): any {
  // Don't use 'any'
}
```

### ESLint Configuration

Backend uses ESLint with TypeScript support:

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

Rules enforced:
- No unused variables
- No explicit `any` (use `unknown` instead)
- Consistent import order
- No console.log in production code (use logger)

### Prettier Formatting

Code is automatically formatted on commit via Husky:

```bash
# Format all files
npm run format

# Check formatting
npx prettier --check "**/*.{js,ts,tsx,json,md}"
```

Configuration (`.prettierrc`):
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### File Organization

```
backend/
  services/
    ride/
      src/
        rider.service.ts      # Business logic
        rider.controller.ts   # Route handlers
        rider.routes.ts       # Route definitions
        rider.validation.ts   # Zod schemas
  packages/
    shared/
      src/
        jwt.ts               # Utility modules
        cache.ts
    db/
      src/
        index.ts             # Prisma client exports
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `trip-service.ts` |
| Classes | PascalCase | `TripService` |
| Functions | camelCase | `createTrip()` |
| Variables | camelCase | `tripId` |
| Constants | UPPER_SNAKE_CASE | `MAX_OFFERS` |
| Interfaces | PascalCase | `TripData` |
| Enums | PascalCase | `TripStatus` |

### Comments

Write self-documenting code, use comments sparingly:

```typescript
// Bad: Obvious comment
// Increment counter by 1
counter++;

// Good: Explain why
// Throttle GPS updates to avoid overwhelming Redis
if (Date.now() - lastUpdate < GPS_THROTTLE_MS) {
  return;
}

// Good: Complex algorithm explanation
/**
 * Uses Uber H3 to find nearby drivers efficiently.
 * 
 * Algorithm:
 * 1. Convert pickup lat/lng to H3 cell (resolution 8)
 * 2. Get surrounding cells with gridDisk
 * 3. Query Redis for driver IDs in those cells
 * 4. Filter by Haversine distance
 * 
 * @param pickupLat - Pickup latitude
 * @param pickupLng - Pickup longitude
 * @param vehicleType - CAR or BIKE
 * @returns Array of driver IDs within MATCH_RADIUS_KM
 */
async function nearbyDrivers(
  pickupLat: number,
  pickupLng: number,
  vehicleType: VehicleType
): Promise<number[]> {
  // Implementation
}
```

## Development Tools

### Pre-commit Hooks (Husky)

Hooks run automatically on `git commit`:

```bash
# .husky/pre-commit
npm run lint
npm run format
npm test
```

If hooks fail, commit is blocked. Fix issues and try again.

### TypeScript Compiler

```bash
# Check types (backend)
cd backend
npx tsc --noEmit

# Watch mode
npx tsc --noEmit --watch
```

### Prisma Studio

GUI for database inspection:

```bash
cd backend
npm run db:studio
# Opens http://localhost:5555
```

### Hot Reload

All services support hot reload:

- **Backend**: `tsx watch` automatically restarts on file changes
- **Next.js**: Fast Refresh for React components
- **Expo**: Metro bundler hot reload

## Testing Requirements

### Before Submitting PR

All PRs must:
- ✅ Pass existing tests
- ✅ Add tests for new features
- ✅ Maintain or improve code coverage

### Running Tests

```bash
# Backend unit/integration tests
cd backend
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Admin E2E tests
cd admin
npm run test:e2e

# Mobile tests
cd rider  # or driver
npm test
```

### Writing Tests

**Unit Tests**:
```typescript
// backend/tests/fare.test.ts
import { describe, it, expect } from 'vitest';
import { calculateFare } from '../src/utils/fare';

describe('calculateFare', () => {
  it('should calculate base fare correctly', () => {
    const fare = calculateFare(5, 'CAR', 'toronto');
    expect(fare).toBeGreaterThan(0);
  });

  it('should apply surge multiplier', () => {
    const normalFare = calculateFare(5, 'CAR', 'toronto');
    const surgeFare = calculateFare(5, 'CAR', 'toronto', 1.5);
    expect(surgeFare).toBe(normalFare * 1.5);
  });
});
```

**Integration Tests**:
```typescript
// backend/tests/trip-lifecycle.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createTestUser } from './helpers';

describe('Trip Lifecycle', () => {
  let riderToken: string;
  let driverToken: string;

  beforeEach(async () => {
    const rider = await createTestUser('RIDER');
    const driver = await createTestUser('DRIVER');
    riderToken = rider.token;
    driverToken = driver.token;
  });

  it('should complete full trip lifecycle', async () => {
    // Create trip
    const tripRes = await request(app)
      .post('/api/rider/trips')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({
        pickupLat: 43.65,
        pickupLng: -79.38,
        dropoffLat: 43.66,
        dropoffLng: -79.39,
        vehicleType: 'CAR'
      });
    
    expect(tripRes.status).toBe(201);
    const tripId = tripRes.body.trip.id;

    // Submit offer
    const offerRes = await request(app)
      .post('/api/driver/offers')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ tripId, fare: 15.50 });
    
    expect(offerRes.status).toBe(201);

    // Accept offer
    const acceptRes = await request(app)
      .post(`/api/rider/trips/${tripId}/accept-offer`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ offerId: offerRes.body.offer.id });
    
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.trip.status).toBe('ASSIGNED');
  });
});
```

### Test Coverage Requirements

Target coverage (per [TESTING.md](TESTING.md)):
- Backend: 70% statements, 60% branches
- Frontend: 60% statements, 50% branches
- Critical paths: 90%+ coverage

## Code Review Guidelines

### As a Reviewer

- [ ] Code follows style guidelines
- [ ] Logic is clear and correct
- [ ] Tests cover new functionality
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Documentation updated
- [ ] Breaking changes noted

### Review Checklist

**Functionality**:
- Does the code do what it's supposed to?
- Are edge cases handled?
- Is error handling appropriate?

**Code Quality**:
- Is the code readable?
- Are functions small and focused?
- Are names descriptive?
- Is there unnecessary complexity?

**Security**:
- Are inputs validated?
- Are secrets hardcoded?
- Are authentication/authorization checks present?

**Performance**:
- Are database queries optimized?
- Are there N+1 query issues?
- Is caching used appropriately?

### Providing Feedback

```markdown
# Good feedback
❌ This will cause a memory leak if the connection drops.
Suggestion: Add error handling and connection cleanup.

✅ Consider extracting this logic into a utility function for reusability.

💡 Great use of caching here! This will significantly improve performance.

# Bad feedback
❌ This is wrong.
❌ I don't like this.
❌ Do it differently.
```

### Addressing Feedback

- Be open to suggestions
- Ask for clarification if needed
- Explain your reasoning if you disagree
- Make requested changes or discuss alternatives
- Mark conversations as resolved when addressed

## Debugging

### Backend Debugging

**VS Code Launch Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Gateway",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal"
    }
  ]
}
```

**Logging**:
```typescript
// Use logger, not console.log
import { logger } from '@eve/shared';

logger.info('Trip created', { tripId, riderId });
logger.warn('High offer count', { tripId, count });
logger.error('Database error', { error });
```

**Debugging Prisma Queries**:
```bash
# Enable query logging
DATABASE_URL="postgresql://...?log=query"

# Or in code
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### Frontend Debugging

**React Native Debugger**:
```bash
# Install
brew install --cask react-native-debugger

# Start app with debugger
npx expo start --dev-client
# Press 'j' to open debugger
```

**Next.js Debugging**:
```bash
# Check browser console
# Use React DevTools extension
# Check Network tab for API calls
```

### Common Issues

**"Module not found"**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

**"Prisma Client not generated"**:
```bash
cd backend
npm run db:generate
```

**"Port already in use"**:
```bash
lsof -i :4003
kill -9 <PID>
```

## Database Management

### Creating Migrations

```bash
cd backend

# Create migration from schema changes
npm run db:migrate

# Name your migration descriptively
# Example: "20240901_add_driver_ratings"
```

### Resetting Database

```bash
# Development only!
cd backend
npm run db:reset  # Drops, recreates, migrates, seeds
```

### Seeding Data

```bash
# Run seed script
npm run db:seed

# Seed creates:
# - Admin users (owner@eve.local, etc.)
# - Sample riders
# - Sample drivers
# - Fare configurations
# - Markets and zones
```

### Schema Changes

1. Edit `backend/prisma/schema.prisma`
2. Run `npm run db:migrate`
3. Update TypeScript types if needed
4. Update seed script if needed
5. Test migrations on clean database

## Common Tasks

### Adding a New API Endpoint

1. **Define Zod schema** (validation):
```typescript
// backend/services/ride/src/trip.validation.ts
export const createTripSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  vehicleType: z.enum(['CAR', 'BIKE']),
});
```

2. **Create service method**:
```typescript
// backend/services/ride/src/trip.service.ts
export async function createTrip(riderId: number, data: CreateTripInput) {
  // Business logic
  const trip = await prisma.trip.create({ data });
  return trip;
}
```

3. **Add controller**:
```typescript
// backend/services/ride/src/trip.controller.ts
export async function createTripHandler(req: Request, res: Response) {
  const riderId = req.user!.id;
  const trip = await createTrip(riderId, req.body);
  res.status(201).json({ trip });
}
```

4. **Register route**:
```typescript
// backend/services/ride/src/trip.routes.ts
router.post('/trips', 
  requireAuth,
  validate(createTripSchema),
  createTripHandler
);
```

5. **Write tests**:
```typescript
// backend/tests/trip.test.ts
it('should create trip', async () => {
  const res = await request(app)
    .post('/api/rider/trips')
    .set('Authorization', `Bearer ${token}`)
    .send(validTripData);
  
  expect(res.status).toBe(201);
  expect(res.body.trip.id).toBeDefined();
});
```

### Adding a Database Model

1. **Update Prisma schema**:
```prisma
// backend/prisma/schema.prisma
model Rating {
  id        Int      @id @default(autoincrement())
  tripId    Int      @unique
  trip      Trip     @relation(fields: [tripId], references: [id])
  rating    Int      @db.SmallInt
  comment   String?
  createdAt DateTime @default(now())
}
```

2. **Create migration**:
```bash
npm run db:migrate
```

3. **Update seed** (if needed):
```typescript
// backend/prisma/seed.ts
await prisma.rating.create({
  data: { tripId: 1, rating: 5, comment: 'Great ride!' }
});
```

4. **Use in code**:
```typescript
const rating = await prisma.rating.create({
  data: { tripId, rating, comment },
  include: { trip: true },
});
```

### Adding Environment Variable

1. **Add to `.env.example`**:
```bash
# New feature configuration
NEW_FEATURE_ENABLED=false
```

2. **Document in [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)**

3. **Access in code**:
```typescript
const enabled = process.env.NEW_FEATURE_ENABLED === 'true';
```

4. **Add TypeScript type** (optional):
```typescript
// backend/src/types/env.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEW_FEATURE_ENABLED?: string;
    }
  }
}
```

## Resources

- [Getting Started Guide](GETTING_STARTED.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Testing Standards](TESTING.md)
- [Security Policy](SECURITY.md)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Prisma Documentation](https://www.prisma.io/docs)

---

**Last Updated**: 2026-09-01
