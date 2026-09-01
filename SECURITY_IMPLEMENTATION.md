# Security Improvements Implementation Guide

This document provides implementation guidance for the remaining security tasks from the audit.

## Completed Tasks ✅

1. ✅ Internal API authentication
2. ✅ Password reset code leakage fixes
3. ✅ WebSocket IDOR vulnerability
4. ✅ JWT algorithm specification
5. ✅ Driver route role enforcement
6. ✅ Rate limiting tightened
7. ✅ Rider app auth guards
8. ✅ SecureStore configuration
9. ✅ 401 error handling

## Remaining High-Priority Tasks

### 1. Token Refresh Mechanism (high-jwt-refresh)

**Current State**: Mobile JWT tokens valid for 30 days, no refresh mechanism

**Implementation Steps**:

1. **Update JWT Service** (`backend/packages/shared/src/jwt.ts`):
```typescript
// Reduce mobile access token TTL
const MOBILE_ACCESS_TTL_SECONDS = 4 * 60 * 60; // 4 hours instead of 30 days
const MOBILE_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Add refresh token type
export type RefreshTokenPayload = {
  sub: string;
  type: 'refresh';
};

// Create refresh token function
export function createRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    jwtSecret(),
    {
      expiresIn: MOBILE_REFRESH_TTL_SECONDS,
      algorithm: "HS256",
    },
  );
}

// Verify refresh token
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, jwtSecret(), {
    algorithms: ["HS256"],
  }) as RefreshTokenPayload;
  
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  
  return payload;
}
```

2. **Update Auth Service** (`backend/services/auth/src/auth.service.ts`):
```typescript
// Return both tokens on login/exchange
export async function exchangeAuth0IdToken(idToken: string, role: 'RIDER' | 'DRIVER') {
  // ... existing verification logic ...
  
  return {
    accessToken: createAccessToken({ id: user.id, role, adminStaffRole: null }),
    refreshToken: createRefreshToken(user.id),
    user: sanitizeUser(user),
  };
}
```

3. **Add Refresh Endpoint** (`backend/services/auth/src/routes.ts`):
```typescript
authRouter.post("/refresh", limiter, async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const payload = verifyRefreshToken(refreshToken);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });
    
    if (!user || !user.isActive || user.accountStatus === "BLOCKED") {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }
    
    res.json({
      accessToken: createAccessToken({
        id: user.id,
        role: user.role as UserRole,
        adminStaffRole: user.adminStaffRole,
      }),
    });
  } catch (error) {
    next(error);
  }
});
```

4. **Update Mobile Apps** (both rider and driver):
```typescript
// Store refresh token
await SecureStore.setItemAsync('refresh_token', data.refreshToken, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

// Add axios interceptor for token refresh
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && error.config) {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          await SecureStore.setItemAsync('access_token', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api.request(error.config);
        } catch {
          // Refresh failed, navigate to auth
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
          router.replace('/(auth)/welcome');
        }
      }
    }
    return Promise.reject(error);
  },
);
```

### 2. Admin Input Validation (high-admin-validation)

**Current State**: Admin endpoints pass raw req.body without Zod validation

**Implementation**: Create `backend/gateway/src/admin.validation.ts`:

```typescript
import { z } from "zod";

export const updateRiderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional().nullable(),
  accountStatus: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED", "PENDING", "DEACTIVATED"]).optional(),
});

export const createTripSchema = z.object({
  riderId: z.string().uuid(),
  pickupAddress: z.string().min(1).max(500),
  dropoffAddress: z.string().min(1).max(500),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  vehicleType: z.enum(["BIKE", "CAR"]),
  suggestedFare: z.number().positive(),
});

export const interveneTripSchema = z.object({
  status: z.enum(["CANCELLED", "COMPLETED", "TECHNICAL_FAILURE"]).optional(),
  notes: z.string().max(1000).optional(),
});

export const savePricingSchema = z.object({
  name: z.string().min(1).max(100),
  vehicleType: z.enum(["BIKE", "CAR"]),
  baseFare: z.number().nonnegative(),
  perKmRate: z.number().nonnegative(),
  perMinuteRate: z.number().nonnegative(),
  minimumFare: z.number().positive(),
  // ... add remaining fields
});

// Apply to admin.controller.ts functions
```

### 3. Public Courier Tracking Security (high-public-tracking)

**Implementation Steps**:

1. **Add Token Expiration** (migration):
```sql
ALTER TABLE "Trip" ADD COLUMN "courierTrackingExpiresAt" TIMESTAMP;
```

2. **Update Schema** (`backend/prisma/schema.prisma`):
```prisma
model Trip {
  // ... existing fields
  courierTrackingToken String? @unique
  courierTrackingExpiresAt DateTime?
}
```

3. **Add Expiration Logic** (`backend/services/ride/src/rider.service.ts`):
```typescript
export async function generateCourierToken(tripId: string) {
  const token = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await prisma.trip.update({
    where: { id: tripId },
    data: {
      courierTrackingToken: token,
      courierTrackingExpiresAt: expiresAt,
    },
  });
  
  return token;
}

export async function getPublicCourier(token: string) {
  const trip = await prisma.trip.findUnique({
    where: { courierTrackingToken: token },
    include: { /* ... */ },
  });
  
  if (!trip || !trip.courierTrackingExpiresAt || trip.courierTrackingExpiresAt < new Date()) {
    throw new Error('Invalid or expired tracking link');
  }
  
  // Return minimized data
  return {
    status: trip.status,
    estimatedArrival: trip.estimatedDropoffAt,
    driverName: trip.driver?.name,
    vehicleType: trip.vehicleType,
    // Don't expose full addresses, coordinates, or plate
  };
}
```

4. **Per-Token Rate Limiting**:
```typescript
const courierTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 10 requests per token per 15 minutes
  keyGenerator: (req) => `courier:${req.params.token}`,
});
```

### 4. Document Upload Verification (high-document-upload)

**Implementation** (`backend/services/ride/src/driver.service.ts`):

```typescript
import ImageKit from 'imagekit';

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: 'https://ik.imagekit.io/your-id',
});

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export async function submitDriverDocument(input: {
  driverId: string;
  type: DocumentType;
  fileUrl: string;
  mimeType: string;
  imageKitFileId: string;
}) {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.');
  }
  
  // Verify file exists in ImageKit and belongs to driver's folder
  try {
    const fileDetails = await imagekit.getFileDetails(input.imageKitFileId);
    
    const expectedFolder = `${process.env.IMAGEKIT_DRIVER_FOLDER}/${input.driverId}`;
    if (!fileDetails.filePath.startsWith(`/${expectedFolder}/`)) {
      throw new Error('File does not belong to driver');
    }
    
    // Verify MIME type matches
    if (fileDetails.mime !== input.mimeType) {
      throw new Error('MIME type mismatch');
    }
  } catch (error) {
    throw new Error('Failed to verify document upload');
  }
  
  // ... rest of document creation logic
}
```

## Infrastructure & Configuration Tasks

### Auth0 Universal Links (medium-auth0-universal-links)

**Documentation Only** - Requires manual Auth0 and Apple/Google configuration:

1. **iOS Associated Domains**:
   - Add `associatedDomains` to `app.json`:
```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:yourdomain.com"]
    }
  }
}
```
   - Host AASA file at `https://yourdomain.com/.well-known/apple-app-site-association`

2. **Android App Links**:
   - Add intent filters to `app.json`
   - Host `assetlinks.json` at `https://yourdomain.com/.well-known/assetlinks.json`

3. **Update Auth0 Callbacks**:
   - Replace `eve://` with `https://yourdomain.com/auth/callback`

### Separate Auth0 Clients (medium-separate-auth0-clients)

**Documentation Only**:

1. Create two Auth0 Native applications:
   - "Eve Rider App"  
   - "Eve Driver App"

2. Update environment variables:
```bash
# Rider
EXPO_PUBLIC_AUTH0_CLIENT_ID=rider_client_id

# Driver  
EXPO_PUBLIC_AUTH0_CLIENT_ID=driver_client_id
```

3. Configure separate callback URLs for each

### GDPR Compliance (medium-gdpr-compliance)

**Implementation Required**: Large feature scope

1. **Data Export API**:
```typescript
// backend/services/auth/src/routes.ts
router.get("/me/export", requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const data = await exportUserData(user.id);
  res.json(data);
});
```

2. **Account Deletion**:
```typescript
router.delete("/me", requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  await deleteUserAccount(user.id);
  res.json({ message: "Account deleted" });
});
```

3. **Add Privacy Request tracking in schema**

### Deployment Security (high-deployment-security)

**Recommended Approach**: Migrate to GitHub Actions + AWS ECS/ECR

See separate `docs/deployment-guide.md` (create if needed)

### Monitoring & Logging (monitoring-setup)

**Tools**: CloudWatch, DataDog, or similar

Key metrics to track:
- Failed login attempts (>10 in 5min)
- 401/403 responses spike
- Rate limit violations
- Internal API calls without secret
- Password reset requests

### CI Security Testing (testing-automation)

**Add to `.github/workflows/security.yml`**:

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: cd backend && npm ci
      - name: Run npm audit
        run: cd backend && npm audit --audit-level=high
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main
```

## Testing Checklist

After implementing each fix:

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing on dev environment
- [ ] Security-specific test cases added
- [ ] Documentation updated
- [ ] Environment variables documented

## Rollout Plan

1. **Week 1**: Implement token refresh (already prepared above)
2. **Week 2**: Admin validation + document verification  
3. **Week 3**: Public tracking improvements
4. **Week 4**: Infrastructure improvements (Auth0, deployment)
5. **Ongoing**: GDPR features, monitoring, CI security

## Questions or Issues

Contact security@eve.example.com or open a discussion in the security channel.
