# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used across the Eve platform.

## Table of Contents

- [Backend Services](#backend-services)
- [Mobile Apps](#mobile-apps)
- [Web Applications](#web-applications)
- [Security Best Practices](#security-best-practices)
- [Environment Examples](#environment-examples)

## Backend Services

All backend services share a common `.env` file in `backend/.env`.

### Required Variables

These variables **must** be set for the backend to function:

| Variable | Description | Example | Where Used |
|----------|-------------|---------|------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://eve:eve@localhost:5432/eve` | All services |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | Generate with `openssl rand -base64 32` | Auth service |
| `PRIVY_APP_ID` | Privy application ID | `clxxxxxxxx` | Auth service |
| `PRIVY_APP_SECRET` | Privy application secret | `xxxxx` | Auth service |

### Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection URL | - | ✅ Yes |
| `POSTGRES_USER` | PostgreSQL username | `eve` | Docker only |
| `POSTGRES_PASSWORD` | PostgreSQL password | `eve` | Docker only |
| `POSTGRES_DB` | Database name | `eve` | Docker only |
| `POSTGRES_PORT` | PostgreSQL port | `5432` | Docker only |

**Examples**:
```bash
# Local development with Docker
DATABASE_URL=postgresql://eve:eve@localhost:5432/eve

# Docker Compose (use service name)
DATABASE_URL=postgresql://eve:eve@postgres:5432/eve

# Production with connection pooling
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
```

### Redis Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | ✅ Yes |
| `REDIS_PORT` | Redis port | `6379` | Docker only |

**Examples**:
```bash
# Local development
REDIS_URL=redis://localhost:6379

# Docker Compose
REDIS_URL=redis://redis:6379

# Production with authentication
REDIS_URL=redis://:password@host:6379

# Redis Cluster
REDIS_SENTINEL_HOSTS=host1:26379,host2:26379
REDIS_SENTINEL_NAME=mymaster
```

### JWT and Authentication

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `JWT_ACCESS_SECRET` | Secret for access tokens | 32+ char random string | ✅ Yes |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | 32+ char random string | No |
| `PASSWORD_RESET_SECRET` | Secret for reset tokens | 32+ char random string | Yes |
| `PRIVY_APP_ID` | Privy application ID | `clxxxxxxxx` | ✅ Yes (for mobile) |
| `PRIVY_APP_SECRET` | Privy application secret | `xxxxx` | ✅ Yes (for mobile) |

**Generate secrets**:
```bash
# JWT secrets
openssl rand -base64 32

# Password reset secret
openssl rand -base64 32

# Internal service secret
openssl rand -base64 48
```

### Service Ports and URLs

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AUTH_PORT` | Auth service port | `4001` | No |
| `LOCATION_PORT` | Location HTTP port | `4002` | No |
| `RIDE_PORT` | Ride service port | `4003` | No |
| `NOTIFY_PORT` | Notify HTTP/Socket.IO port | `4004` | No |
| `ADMIN_PORT` | Admin API port | `4005` | No |
| `LOCATION_GRPC_PORT` | Location gRPC | `50051` | No |
| `NOTIFY_GRPC_PORT` | Notify gRPC | `50052` | No |
| `LOCATION_GRPC_URL` | gRPC client target | `127.0.0.1:50051` | No |
| `NOTIFY_GRPC_URL` | gRPC client target | `127.0.0.1:50052` | No |

There is no HTTP gateway and no `GATEWAY_MODE`. From `backend/`, `npm run dev` starts all five services.

Docker Compose sets `LOCATION_GRPC_URL=location:50051` and `NOTIFY_GRPC_URL=notify:50052`.

### Internal Service Security

| Variable | Description | Required |
|----------|-------------|----------|
| `INTERNAL_SERVICE_SECRET` | Secret for inter-service authentication | Production only |

**Usage**:
```bash
# Generate
openssl rand -base64 48

# In production, services use this header:
X-Internal-Secret: <secret>
```

### Location Service

Match radius is **`MATCH_RADIUS_KM = 15`** in `backend/packages/shared/src/distance.ts`. It is **not** read from the environment. Change the constant and restart services; do not set `MATCH_RADIUS_KM` in `.env`.

### gRPC Configuration

gRPC between ride/admin and location/notify is always on. There is no `GRPC_ENABLED` flag. If the gRPC peer is down, clients fall back to HTTP then in-process matching.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GRPC_LOGGING` | Log gRPC requests | `false` | No |
| `LOCATION_GRPC_PORT` | Location gRPC port | `50051` | Yes |
| `NOTIFY_GRPC_PORT` | Notify gRPC port | `50052` | Yes |
| `LOCATION_GRPC_URL` | Location gRPC URL | `127.0.0.1:50051` | Yes |
| `NOTIFY_GRPC_URL` | Notify gRPC URL | `127.0.0.1:50052` | Yes |

```bash
LOCATION_GRPC_URL=127.0.0.1:50051
NOTIFY_GRPC_URL=127.0.0.1:50052
# Docker
# LOCATION_GRPC_URL=location:50051
# NOTIFY_GRPC_URL=notify:50052
```

### ImageKit (Driver Documents)

| Variable | Description | Required |
|----------|-------------|----------|
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private API key | Yes |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public API key | Yes |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit CDN endpoint | Yes |
| `IMAGEKIT_DRIVER_FOLDER` | Folder for driver uploads | No |

**Get credentials**: https://imagekit.io/dashboard

```bash
IMAGEKIT_PRIVATE_KEY=private_abc123...
IMAGEKIT_PUBLIC_KEY=public_abc123...
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id
IMAGEKIT_DRIVER_FOLDER=/eve/drivers
```

### Driver Eve Wallet (optional)

Platform credits cash out to the driver's Privy Ethereum address. Trip fares are not sent on-chain.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TREASURY_PRIVATE_KEY` | Hex key that pays drivers | — | For on-chain send |
| `CHAIN_RPC_URL` | JSON-RPC URL | — | For on-chain send |
| `PAYOUT_CHAIN_ID` | EVM chain id | `84532` (Base Sepolia) | No |
| `PAYOUT_CHAIN_NAME` | Display name | `Base Sepolia` | No |
| `PAYOUT_EXPLORER_TX_URL` | Explorer prefix | Base Sepolia | No |
| `PAYOUT_TOKEN_ADDRESS` | ERC-20; empty = native ETH | — | No |
| `PAYOUT_TOKEN_SYMBOL` | Display symbol | `ETH` or `USDC` | No |
| `PAYOUT_TOKEN_DECIMALS` | Token decimals | `18` native / `6` ERC-20 | No |
| `PAYOUT_USD_PER_TOKEN` | Ledger USD per 1 token | `1` | No |

If treasury env is unset, `POST /api/driver/wallet/withdraw` stays `PENDING`. See [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md).

### Email Configuration (Optional)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SMTP_HOST` | SMTP server host | - | No |
| `SMTP_PORT` | SMTP server port | `587` | No |
| `SMTP_SECURE` | Use TLS | `false` | No |
| `SMTP_USER` | SMTP username | - | No |
| `SMTP_PASS` | SMTP password | - | No |
| `EMAIL_FROM` | From email address | - | No |

**Email Providers**:
```bash
# SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your-api-key>

# AWS SES
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<access-key-id>
SMTP_PASS=<secret-access-key>
```

### CORS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGINS` | Allowed browser origins (comma-separated) | `http://localhost:3000,...` | No |

**Examples**:
```bash
# Development (default)
CORS_ORIGINS=http://localhost:3000,http://localhost:3020,http://localhost:8081

# Production
CORS_ORIGINS=https://admin.example.com
```

### Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |
| `RATE_LIMIT_WINDOW` | Window in minutes | `15` | No |
| `DRIVER_API_RATE_LIMIT` | Max authenticated Driver API requests per 15 minutes | `2000` | No |

### Logging

| Variable | Description | Values | Default |
|----------|-------------|--------|---------|
| `LOG_LEVEL` | Logging verbosity | `error`, `warn`, `info`, `debug` | `info` |

### Testing

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITEST` | Enable test mode | `false` | Tests only |

## Mobile Apps

### Rider App (`rider/.env`)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `EXPO_PUBLIC_AUTH_URL` | Auth HTTP base | `http://192.168.1.100:4001/api` | ✅ Yes |
| `EXPO_PUBLIC_API_URL` | Ride HTTP base | `http://192.168.1.100:4003/api` | ✅ Yes |
| `EXPO_PUBLIC_WS_URL` | Notify Socket.IO | `http://192.168.1.100:4004` | ✅ Yes |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Privy application ID | `clxxxxxxxx` | ✅ Yes |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Privy app client ID | `client_xxx` | ✅ Yes |
| `EXPO_PUBLIC_PRIVY_RELYING_PARTY` | Passkey origin (https) | `https://your-domain.com` | ✅ Yes |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox public token | `pk.abc123...` | ✅ Yes |

**Important Notes**:
- Use your machine's **LAN IP**, not `localhost`, for mobile devices
- Prefix all variables with `EXPO_PUBLIC_` to expose to client
- Restart Metro bundler after changing env vars: `npx expo start --clear`
- Rebuild dev client after changing Privy native config: `npx expo run:ios`

**Find your LAN IP**:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4
```

**Example**:
```bash
EXPO_PUBLIC_AUTH_URL=http://192.168.1.100:4001/api
EXPO_PUBLIC_API_URL=http://192.168.1.100:4003/api
EXPO_PUBLIC_WS_URL=http://192.168.1.100:4004
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-privy-client-id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoibm...
```

### Driver App (`driver/.env`)

Same variables as Rider app:

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_AUTH_URL` | Auth HTTP base | ✅ Yes |
| `EXPO_PUBLIC_API_URL` | Ride HTTP base | ✅ Yes |
| `EXPO_PUBLIC_WS_URL` | Notify Socket.IO | ✅ Yes |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Privy application ID | ✅ Yes |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Privy app client ID | ✅ Yes |
| `EXPO_PUBLIC_PRIVY_RELYING_PARTY` | Passkey relying party URL | ✅ Yes |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox token | ✅ Yes |

**Note**: Rider and driver apps should use **different** Privy app clients.

## Web Applications

### Admin Console (`admin/.env.local`)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_API_URL` | API base URL (for browser) | `/api` | ✅ Yes |
| `AUTH_PROXY_TARGET` | Auth rewrite | `http://127.0.0.1:4001` | No |
| `RIDE_PROXY_TARGET` | Ride rewrite | `http://127.0.0.1:4003` | No |
| `NOTIFY_PROXY_TARGET` | Socket.IO rewrite | `http://127.0.0.1:4004` | No |
| `ADMIN_PROXY_TARGET` | Admin API rewrite | `http://127.0.0.1:4005` | No |
| `NEXT_PUBLIC_NOTIFY_URL` | Socket.IO origin | `http://127.0.0.1:4004` | No |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox token | `pk.abc123...` | No |

**How it works**:
- Browser calls `/api/*` (same-origin)
- Next.js rewrites to auth, ride, admin, and notify

**Example**:
```bash
NEXT_PUBLIC_API_URL=/api
AUTH_PROXY_TARGET=http://127.0.0.1:4001
RIDE_PROXY_TARGET=http://127.0.0.1:4003
NOTIFY_PROXY_TARGET=http://127.0.0.1:4004
ADMIN_PROXY_TARGET=http://127.0.0.1:4005
NEXT_PUBLIC_NOTIFY_URL=http://127.0.0.1:4004
```

## Security Best Practices

### Development vs Production

**Development** (`.env`):
- Simple passwords OK
- localhost URLs
- Debug logging enabled
- Email delivery optional

**Production** (`.env.prod`):
- Strong, random secrets ✅
- HTTPS URLs only ✅
- Production Privy app ✅
- Email delivery required ✅
- Internal service secret set ✅
- Rate limits configured ✅

### Generating Secure Secrets

```bash
# JWT secrets (32+ characters)
openssl rand -base64 32

# Password reset secret
openssl rand -base64 32

# Internal service secret (48+ characters)
openssl rand -base64 48
```

### Storing Secrets

**Never commit**:
- ❌ `.env` files
- ❌ Passwords or API keys
- ❌ JWT secrets

**Use**:
- ✅ `.env.example` (template with no secrets)
- ✅ Secret managers (AWS Secrets Manager, HashiCorp Vault)
- ✅ Environment variables in CI/CD
- ✅ Encrypted storage

### Rotating Secrets

When rotating `JWT_ACCESS_SECRET`:
1. Set new secret in environment
2. Restart all backend services
3. Old JWTs become invalid
4. Users must re-authenticate

## Environment Examples

### Development (Local)

**`backend/.env`**:
```bash
NODE_ENV=development
DATABASE_URL=postgresql://eve:eve@localhost:5432/eve
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=dev-secret-change-in-production
PASSWORD_RESET_SECRET=reset-dev-secret
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
AUTH_PORT=4001
RIDE_PORT=4003
LOCATION_GRPC_URL=127.0.0.1:50051
NOTIFY_GRPC_URL=127.0.0.1:50052
```

**`admin/.env.local`**:
```bash
NEXT_PUBLIC_API_URL=/api
AUTH_PROXY_TARGET=http://127.0.0.1:4001
RIDE_PROXY_TARGET=http://127.0.0.1:4003
NOTIFY_PROXY_TARGET=http://127.0.0.1:4004
ADMIN_PROXY_TARGET=http://127.0.0.1:4005
NEXT_PUBLIC_NOTIFY_URL=http://127.0.0.1:4004
```

**`rider/.env`**:
```bash
EXPO_PUBLIC_AUTH_URL=http://192.168.1.100:4001/api
EXPO_PUBLIC_API_URL=http://192.168.1.100:4003/api
EXPO_PUBLIC_WS_URL=http://192.168.1.100:4004
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your_client_id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token
```

### Docker Compose

**`backend/.env`**:
```bash
NODE_ENV=development
DATABASE_URL=postgresql://eve:eve@postgres:5432/eve
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=dev-secret
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
LOCATION_GRPC_URL=location:50051
NOTIFY_GRPC_URL=notify:50052
```

### Production

**`backend/.env.prod`**:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:strongpass@db-host:5432/eve_prod?sslmode=require
REDIS_URL=redis://:redispass@redis-host:6379
JWT_ACCESS_SECRET=<64-char-random-string>
PASSWORD_RESET_SECRET=<64-char-random-string>
INTERNAL_SERVICE_SECRET=<96-char-random-string>
PRIVY_APP_ID=prod-privy-app-id
PRIVY_APP_SECRET=prod-privy-app-secret
LOCATION_GRPC_URL=location:50051
NOTIFY_GRPC_URL=notify:50052
IMAGEKIT_PRIVATE_KEY=<private-key>
IMAGEKIT_PUBLIC_KEY=<public-key>
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/prod-id
CORS_ORIGINS=https://admin.example.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
EMAIL_FROM=noreply@example.com
LOG_LEVEL=warn
LOCATION_GRPC_URL=location-internal:50051
NOTIFY_GRPC_URL=notify-internal:50052
```

## Troubleshooting

### Common Issues

**Error**: `JWT_ACCESS_SECRET is required`
- **Solution**: Set `JWT_ACCESS_SECRET` in `backend/.env`

**Error**: `Cannot connect to database`
- **Solution**: Check `DATABASE_URL` format and PostgreSQL is running

**Error**: Privy identity token rejected
- **Solution**: Enable identity tokens in the Privy Dashboard and set `PRIVY_APP_ID` / `PRIVY_APP_SECRET`

**Error**: `CORS error from browser`
- **Solution**: Add your origin to `CORS_ORIGINS` or use `/api` proxy in Next.js

**Error**: `Mobile app cannot connect to API`
- **Solution**: Use LAN IP, not `localhost`, in `EXPO_PUBLIC_AUTH_URL`, `EXPO_PUBLIC_API_URL`, and `EXPO_PUBLIC_WS_URL`

### Verification Checklist

```bash
# Backend
cd backend
grep -E "^(DATABASE_URL|JWT_ACCESS_SECRET|PRIVY_APP_ID)=" .env

# Admin
cd admin
grep -E "^(NEXT_PUBLIC_API_URL|AUTH_PROXY_TARGET|RIDE_PROXY_TARGET)=" .env.local

# Mobile apps
cd rider
grep -E "^EXPO_PUBLIC_" .env
```

## Related Documentation

- [Getting Started Guide](GETTING_STARTED.md) - Setup instructions
- [Backend Auth Documentation](backend/docs/auth.md) - Privy setup
- [Security Policy](SECURITY.md) - Security best practices
- [Deployment Guide](DEPLOYMENT.md) - Production configuration

---

**Last Updated**: 2026-09-01
