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
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | Generate with `openssl rand -base64 32` | Auth service, Gateway |
| `AUTH0_DOMAIN` | Auth0 tenant domain (no https://) | `your-tenant.us.auth0.com` | Auth service |
| `AUTH0_CLIENT_ID` | Auth0 Native application client ID | `abc123...` | Auth service |

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
| `AUTH0_DOMAIN` | Auth0 tenant domain | `tenant.us.auth0.com` | ✅ Yes (for mobile) |
| `AUTH0_CLIENT_ID` | Auth0 client ID | `abc123...` | ✅ Yes (for mobile) |

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
| `PORT` | Gateway listen port | `4000` | No |
| `AUTH_PORT` | Auth service port | `4001` | Proxy mode |
| `LOCATION_PORT` | Location service port | `4002` | Proxy mode |
| `RIDE_PORT` | Ride service port | `4003` | Proxy mode |
| `NOTIFY_PORT` | Notify service port | `4004` | Proxy mode |
| `AUTH_URL` | Auth service URL | `http://localhost:4001` | Proxy mode |
| `LOCATION_URL` | Location service URL | `http://localhost:4002` | Proxy mode |
| `RIDE_URL` | Ride service URL | `http://localhost:4003` | Proxy mode |
| `NOTIFY_URL` | Notify service URL | `http://localhost:4004` | Proxy mode |

**Compose vs Proxy Mode**:
```bash
# Compose Mode (default) - single process
GATEWAY_MODE=compose
# No service URLs needed

# Proxy Mode - multiple processes
GATEWAY_MODE=proxy
AUTH_URL=http://localhost:4001
LOCATION_URL=http://localhost:4002
RIDE_URL=http://localhost:4003
NOTIFY_URL=http://localhost:4004

# Docker (use service names)
AUTH_URL=http://auth:4001
LOCATION_URL=http://location:4002
RIDE_URL=http://ride:4003
NOTIFY_URL=http://notify:4004
```

### Gateway Configuration

| Variable | Description | Values | Default |
|----------|-------------|--------|---------|
| `GATEWAY_MODE` | Gateway operation mode | `compose`, `proxy` | `compose` |
| `NODE_ENV` | Environment | `development`, `production` | `development` |

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

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MATCH_RADIUS_KM` | Driver matching radius (km) | `25` | No |

**Matching Configuration**:
```bash
# Default: 25km radius
MATCH_RADIUS_KM=25

# Urban area: smaller radius
MATCH_RADIUS_KM=15

# Rural area: larger radius
MATCH_RADIUS_KM=40
```

### gRPC Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GRPC_ENABLED` | Enable gRPC for inter-service calls | `false` | No |
| `GRPC_LOGGING` | Log gRPC requests | `false` | No |
| `LOCATION_GRPC_PORT` | Location gRPC port | `50051` | gRPC mode |
| `NOTIFY_GRPC_PORT` | Notify gRPC port | `50052` | gRPC mode |
| `LOCATION_GRPC_URL` | Location gRPC URL | `localhost:50051` | gRPC mode |
| `NOTIFY_GRPC_URL` | Notify gRPC URL | `localhost:50052` | gRPC mode |

**gRPC Setup**:
```bash
# Enable gRPC
GRPC_ENABLED=true
GRPC_LOGGING=true

# Service URLs
LOCATION_GRPC_URL=localhost:50051
NOTIFY_GRPC_URL=localhost:50052

# Docker
LOCATION_GRPC_URL=location:50051
NOTIFY_GRPC_URL=notify:50052
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
CORS_ORIGINS=http://localhost:3000,http://localhost:3010

# Production
CORS_ORIGINS=https://admin.example.com,https://monitor.example.com
```

### Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |
| `RATE_LIMIT_WINDOW` | Window in minutes | `15` | No |

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
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `http://192.168.1.100:4000/api` | ✅ Yes |
| `EXPO_PUBLIC_AUTH0_DOMAIN` | Auth0 domain | `tenant.us.auth0.com` | ✅ Yes |
| `EXPO_PUBLIC_AUTH0_CLIENT_ID` | Auth0 client ID | `abc123...` | ✅ Yes |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox public token | `pk.abc123...` | ✅ Yes |

**Important Notes**:
- Use your machine's **LAN IP**, not `localhost`, for mobile devices
- Prefix all variables with `EXPO_PUBLIC_` to expose to client
- Restart Metro bundler after changing env vars: `npx expo start --clear`
- Rebuild dev client after changing Auth0 config: `npx expo run:ios`

**Find your LAN IP**:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4
```

**Example**:
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000/api
EXPO_PUBLIC_AUTH0_DOMAIN=eve-dev.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=abc123xyz
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoibm...
```

### Driver App (`driver/.env`)

Same variables as Rider app:

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_API_URL` | Backend API URL | ✅ Yes |
| `EXPO_PUBLIC_AUTH0_DOMAIN` | Auth0 domain | ✅ Yes |
| `EXPO_PUBLIC_AUTH0_CLIENT_ID` | Auth0 client ID | ✅ Yes |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox token | ✅ Yes |

**Note**: Rider and driver apps use the **same** Auth0 client.

## Web Applications

### Admin Console (`admin/.env.local`)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_API_URL` | API base URL (for browser) | `/api` | ✅ Yes |
| `API_PROXY_TARGET` | Internal proxy target | `http://127.0.0.1:4000` | ✅ Yes |
| `NEXT_PUBLIC_GATEWAY_URL` | Gateway URL | `http://127.0.0.1:4000` | ✅ Yes |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox token | `pk.abc123...` | No |

**How it works**:
- Browser calls `/api/*` (same-origin, no CORS)
- Next.js rewrites to `API_PROXY_TARGET`
- Gateway responds

**Example**:
```bash
# Development (default)
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=http://127.0.0.1:4000
NEXT_PUBLIC_GATEWAY_URL=http://127.0.0.1:4000

# Production
NEXT_PUBLIC_API_URL=https://api.example.com/api
API_PROXY_TARGET=http://gateway-internal:4000
NEXT_PUBLIC_GATEWAY_URL=https://api.example.com
```

### Monitor Dashboard (`monitor/.env`)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_GATEWAY_URL` | Gateway health check URL | `http://localhost:4000` | Yes |
| `MONITOR_AUTH_URL` | Auth service URL | `http://localhost:4001` | Proxy mode |
| `MONITOR_LOCATION_URL` | Location service URL | `http://localhost:4002` | Proxy mode |
| `MONITOR_RIDE_URL` | Ride service URL | `http://localhost:4003` | Proxy mode |
| `MONITOR_NOTIFY_URL` | Notify service URL | `http://localhost:4004` | Proxy mode |
| `MONITOR_ADMIN_URL` | Admin console URL | `http://localhost:3000` | No |
| `MONITOR_REQUIRE_SPLIT` | Require split services to be healthy | `0` | No |

**Example**:
```bash
# Compose mode (default)
NEXT_PUBLIC_GATEWAY_URL=http://localhost:4000
MONITOR_ADMIN_URL=http://localhost:3000

# Proxy mode (monitor all services)
MONITOR_REQUIRE_SPLIT=1
MONITOR_AUTH_URL=http://localhost:4001
MONITOR_LOCATION_URL=http://localhost:4002
MONITOR_RIDE_URL=http://localhost:4003
MONITOR_NOTIFY_URL=http://localhost:4004
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
- Production Auth0 tenant ✅
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
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
GATEWAY_MODE=compose
PORT=4000
```

**`admin/.env.local`**:
```bash
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=http://127.0.0.1:4000
```

**`rider/.env`**:
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000/api
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your_client_id
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token
```

### Docker Compose

**`backend/.env`**:
```bash
NODE_ENV=development
DATABASE_URL=postgresql://eve:eve@postgres:5432/eve
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=dev-secret
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
GATEWAY_MODE=proxy
AUTH_URL=http://auth:4001
LOCATION_URL=http://location:4002
RIDE_URL=http://ride:4003
NOTIFY_URL=http://notify:4004
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
AUTH0_DOMAIN=prod-tenant.auth0.com
AUTH0_CLIENT_ID=prod_client_id
GATEWAY_MODE=proxy
AUTH_URL=http://auth-internal:4001
LOCATION_URL=http://location-internal:4002
RIDE_URL=http://ride-internal:4003
NOTIFY_URL=http://notify-internal:4004
IMAGEKIT_PRIVATE_KEY=<private-key>
IMAGEKIT_PUBLIC_KEY=<public-key>
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/prod-id
CORS_ORIGINS=https://admin.example.com,https://monitor.example.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
EMAIL_FROM=noreply@example.com
LOG_LEVEL=warn
GRPC_ENABLED=true
LOCATION_GRPC_URL=location-internal:50051
NOTIFY_GRPC_URL=notify-internal:50052
```

## Troubleshooting

### Common Issues

**Error**: `JWT_ACCESS_SECRET is required`
- **Solution**: Set `JWT_ACCESS_SECRET` in `backend/.env`

**Error**: `Cannot connect to database`
- **Solution**: Check `DATABASE_URL` format and PostgreSQL is running

**Error**: `Auth0 domain must not include https://`
- **Solution**: Use `tenant.us.auth0.com` not `https://tenant.us.auth0.com`

**Error**: `CORS error from browser`
- **Solution**: Add your origin to `CORS_ORIGINS` or use `/api` proxy in Next.js

**Error**: `Mobile app cannot connect to API`
- **Solution**: Use LAN IP, not `localhost`, in `EXPO_PUBLIC_API_URL`

### Verification Checklist

```bash
# Backend
cd backend
grep -E "^(DATABASE_URL|JWT_ACCESS_SECRET|AUTH0_DOMAIN)=" .env

# Admin
cd admin
grep -E "^(NEXT_PUBLIC_API_URL|API_PROXY_TARGET)=" .env.local

# Mobile apps
cd rider
grep -E "^EXPO_PUBLIC_" .env
```

## Related Documentation

- [Getting Started Guide](GETTING_STARTED.md) - Setup instructions
- [Backend Auth Documentation](backend/docs/auth.md) - Auth0 setup
- [Security Policy](SECURITY.md) - Security best practices
- [Deployment Guide](DEPLOYMENT.md) - Production configuration

---

**Last Updated**: 2026-09-01
