# Eve Admin Console

Web-based operations dashboard for managing the Eve platform.

**Framework**: Next.js 16 (App Router)  
**Port**: 3000  
**Language**: TypeScript

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Roles and Permissions](#roles-and-permissions)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Admin Console is a web application for Eve platform operations staff to:
- Monitor platform health and metrics
- Manage riders and drivers
- Review and approve driver applications
- Configure pricing (fare configurations)
- View and audit trips
- Handle support requests
- Manage safety incidents

## Features

### Dashboard
- Real-time platform metrics
- Active trips count
- Online drivers count
- Today's revenue
- Recent activity feed
- Key performance indicators

### Rider Management
- List all riders
- Search by email, phone, name
- View rider profile and trip history
- Suspend/reactivate accounts
- View rider support tickets

### Driver Management
- List all drivers (pending, approved, rejected)
- Approve/reject driver applications
- View uploaded documents (license, insurance, registration)
- Check vehicle details
- View driver trip history and earnings
- Suspend/reactivate driver accounts

### Trip Management
- List all trips (searching, active, completed, cancelled)
- Filter by status, date, vehicle type
- View trip details and route on map
- View offers and matched fares
- Audit fare calculations
- View trip timeline and events

### Pricing Management
- Configure fare structures per market
- Set base fare, per-km, per-minute rates
- Configure minimum fares and booking fees
- Set surge multipliers
- Approve pricing changes
- Version control for pricing configs

### Market & Zone Management
- Define geographic markets
- Create pricing zones within markets
- Set zone boundaries (polygons)
- Associate fare configs with zones

### Safety & Support
- View and respond to support tickets
- Flag safety incidents
- Block malicious users
- Export incident reports

## Architecture

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework |
| React | 19 | UI library |
| TypeScript | 5.9+ | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | Latest | Component library |
| Mapbox GL JS | 3.x | Map visualization |
| Socket.IO Client | 4.x | Real-time updates |
| Playwright | Latest | E2E testing |

### Pages (App Router)

```
app/
  (auth)/
    login/              # Staff login
  (dashboard)/
    page.tsx            # Dashboard home
    riders/
      page.tsx          # Riders list
      [id]/page.tsx     # Rider details
    drivers/
      page.tsx          # Drivers list
      [id]/
        page.tsx        # Driver profile
        documents.tsx   # View documents
    trips/
      page.tsx          # Trips list
      [id]/page.tsx     # Trip details
    pricing/
      page.tsx          # Fare configs
      [id]/page.tsx     # Edit fare config
    markets/
      page.tsx          # Markets & zones
    support/
      page.tsx          # Support tickets
```

### API Integration

Admin console calls Eve backend Gateway:

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchRiders() {
  const res = await fetch(`${API_URL}/admin/riders`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
    }
  });
  return res.json();
}
```

**API Prefix**: `/api/admin/*`  
**Authentication**: JWT (email/password login)

### Real-Time Updates

WebSocket connection for live dashboard:

```typescript
// lib/socket.ts
import { io } from 'socket.io-client';

const socket = io(GATEWAY_URL, {
  path: '/socket.io',
  query: { token: getToken() }
});

socket.on('admin:stats-updated', (stats) => {
  updateDashboard(stats);
});
```

## Prerequisites

- **Node.js**: 22.x or higher
- **npm**: 10.x or higher
- **Backend running**: Gateway must be accessible

## Local Development

### 1. Install Dependencies

```bash
cd admin
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# API URL (proxied through Next.js)
NEXT_PUBLIC_API_URL=/api

# Internal proxy target
API_PROXY_TARGET=http://127.0.0.1:4000

# Gateway URL for WebSocket
NEXT_PUBLIC_GATEWAY_URL=http://127.0.0.1:4000

# Mapbox (optional, for trip maps)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token
```

**How it works**:
- Browser calls `/api/*` (same-origin)
- Next.js rewrites to `API_PROXY_TARGET`
- No CORS issues

### 3. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000

### 4. Login

Use seeded admin accounts:

| Email | Password | Role |
|-------|----------|------|
| owner@eve.local | Admin123! | OWNER |
| ops@eve.local | Admin123! | OPERATIONS |
| finance@eve.local | Admin123! | FINANCE |
| support@eve.local | Admin123! | SUPPORT |
| safety@eve.local | Admin123! | SAFETY |

## Project Structure

```
admin/
├── app/                        # App Router pages
│   ├── (auth)/                # Login
│   ├── (dashboard)/           # Protected pages
│   └── layout.tsx             # Root layout
├── components/
│   ├── dashboard/             # Dashboard widgets
│   ├── riders/                # Rider components
│   ├── drivers/               # Driver components
│   ├── trips/                 # Trip components
│   ├── ui/                    # shadcn/ui components
│   └── layout/                # Layout components
├── lib/
│   ├── api.ts                 # API client
│   ├── socket.ts              # WebSocket client
│   ├── auth.ts                # Auth helpers
│   ├── permissions.ts         # RBAC logic
│   └── utils.ts               # Utilities
├── hooks/                     # Custom hooks
├── types/                     # TypeScript types
├── public/                    # Static assets
├── e2e/                       # Playwright tests
│   ├── auth.setup.ts          # Auth fixture
│   ├── dashboard.spec.ts      # Dashboard tests
│   └── trips.spec.ts          # Trip tests
├── next.config.ts             # Next.js config
├── playwright.config.ts       # Playwright config
├── tailwind.config.ts         # Tailwind config
└── .env.local                 # Environment variables
```

## Roles and Permissions

### Role Hierarchy

| Role | Capabilities |
|------|-------------|
| **OWNER** | Full access, manage staff, pricing, all data |
| **OPERATIONS** | Manage trips, drivers, riders, support |
| **FINANCE** | View pricing, earnings, reports |
| **SUPPORT** | View tickets, contact users, limited trip access |
| **SAFETY** | View safety incidents, block users |

### Permission Checks

```typescript
// lib/permissions.ts
export function canApproveDrivers(role: StaffRole): boolean {
  return ['OWNER', 'OPERATIONS'].includes(role);
}

export function canEditPricing(role: StaffRole): boolean {
  return ['OWNER', 'FINANCE'].includes(role);
}

// Usage in components
const canApprove = canApproveDrivers(user.role);
```

### Protected Routes

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  
  if (!token && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

## Testing

### Unit Tests (Future)

```bash
npm test
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test
npx playwright test e2e/dashboard.spec.ts

# Run in UI mode
npx playwright test --ui

# Generate test report
npx playwright show-report
```

**Tests included**:
- Login flow
- Dashboard metrics
- Rider list and search
- Driver approval flow
- Trip details view

### E2E Test Structure

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/owner.json' }); // Use authenticated state

test('shows dashboard metrics', async ({ page }) => {
  await page.goto('/');
  
  await expect(page.getByText('Active Trips')).toBeVisible();
  await expect(page.getByText('Online Drivers')).toBeVisible();
  await expect(page.getByText('Total Revenue')).toBeVisible();
});
```

### Manual Testing Checklist

- [ ] Login with all role types
- [ ] View dashboard metrics
- [ ] Search and filter riders
- [ ] Approve driver application
- [ ] View trip on map
- [ ] Create fare configuration
- [ ] Approve pricing change
- [ ] Handle support ticket

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Test production build locally
npm start
```

### Environment Variables (Production)

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.example.com/api
API_PROXY_TARGET=http://gateway-internal:4000
NEXT_PUBLIC_GATEWAY_URL=https://api.example.com
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.production_token
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Deploy to Docker

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

### Deploy to AWS/Cloud

See [../DEPLOYMENT.md](../DEPLOYMENT.md) for complete deployment guide.

## Troubleshooting

### Cannot login

**Problem**: Invalid credentials or backend not running

**Solution**:
1. Check backend is running: `curl http://localhost:4000/api/health`
2. Verify credentials (seeded accounts use `Admin123!`)
3. Check browser console for errors
4. Check backend logs

### API calls failing with CORS errors

**Problem**: Direct API calls instead of proxy

**Solution**:
```typescript
// Bad: Direct call
fetch('http://localhost:4000/api/riders')

// Good: Use proxy
fetch('/api/admin/riders')
```

Verify `.env.local`:
```bash
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=http://127.0.0.1:4000
```

### Page not updating with real-time data

**Problem**: WebSocket not connected

**Solution**:
1. Check socket connection in browser dev tools (Network → WS)
2. Verify `NEXT_PUBLIC_GATEWAY_URL` is set
3. Check token is valid
4. Reconnect socket after token refresh

### Build errors

**Problem**: TypeScript or dependency issues

**Solution**:
```bash
# Clean install
rm -rf .next node_modules package-lock.json
npm install

# Check TypeScript
npx tsc --noEmit

# Build
npm run build
```

### Playwright tests failing

**Problem**: Test setup or timing issues

**Solution**:
```bash
# Install browsers
npx playwright install

# Run auth setup
npx playwright test e2e/auth.setup.ts

# Run with debug
npx playwright test --debug
```

## Related Documentation

- [Project Overview](../README.md)
- [Getting Started](../GETTING_STARTED.md)
- [Backend API](../backend/docs/)
- [Deployment](../DEPLOYMENT.md)
- [FAQ](../FAQ.md)

## Support

For issues, check [../FAQ.md](../FAQ.md) or contact the development team.

---

**Last Updated**: 2026-09-01
