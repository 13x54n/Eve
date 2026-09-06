# Getting Started with Eve

Alpha path: **PostgreSQL/Redis → backend (`npm run dev`) → rider/driver**. The admin console and marketing site (www) are optional and are not alpha release targets.

This guide will help you set up local development in under 1 hour.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Clone and Install](#step-1-clone-and-install)
- [Step 2: Infrastructure Setup](#step-2-infrastructure-setup)
- [Step 3: Backend Configuration](#step-3-backend-configuration)
- [Step 4: Database Setup](#step-4-database-setup)
- [Step 5: Start Backend Services](#step-5-start-backend-services)
- [Step 6: Admin Console Setup (optional)](#step-6-admin-console-setup-optional)
- [Step 7: Marketing Site Setup (optional)](#step-7-marketing-site-setup-optional)
- [Step 8: Mobile Apps Setup](#step-8-mobile-apps-setup)
- [Verification](#verification)
- [Next Steps](#next-steps)
- [Common Issues](#common-issues)

## Choose a Startup Mode

Use one of these paths for a complete development environment. Both paths run PostgreSQL, Redis, all six backend services, and the optional admin console, marketing site, and mobile clients described below.

### Local backend processes

Use this path when you want hot reload for the backend services:

```bash
cd backend
cp .env.example .env
# Set JWT_ACCESS_SECRET and any Privy, ImageKit, or SMTP values you need.
npm install
docker compose up postgres redis kafka -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The `db:generate` step must run after dependency installation, and `db:migrate` must run before any service handles requests. Keep this terminal open; start the optional clients in separate terminals.

### Full backend in Docker

Use this path when you want Docker to build and run the complete backend stack:

```bash
cd backend
cp .env.example .env
# Set JWT_ACCESS_SECRET and any Privy, ImageKit, or SMTP values you need.
docker compose up --build
```

Compose starts PostgreSQL, Redis, and Kafka, runs Prisma Client generation and `prisma migrate deploy` in the one-shot `migrate` service, and only then starts auth, location, ride, notify, admin, and payment. The admin console is still a separate host process; Rider and Driver Expo apps are never built inside this Compose stack.

## Prerequisites

### Checklist

Before starting, ensure you have:

- [ ] Node.js 22.x or higher installed
- [ ] npm 10.x or higher installed
- [ ] Docker Desktop installed and running
- [ ] At least 8GB RAM available
- [ ] 10GB free disk space
- [ ] Ports 3000, 3020, 4001-4006, 5432, 6379, 8081, 9094 available
- [ ] (Optional) Xcode 15+ for iOS development
- [ ] (Optional) Android Studio for Android development

### Verify Installation

```bash
# Node.js version
node --version
# Expected: v22.x.x or higher

# npm version
npm --version
# Expected: 10.x.x or higher

# Docker version
docker --version
# Expected: Docker version 20.x or higher

# Docker Compose version
docker compose version
# Expected: Docker Compose version v2.x or higher

# Check Docker is running
docker ps
# Should show running containers or empty list (not an error)
```

If any command fails, install the missing prerequisite before continuing.

## Step 1: Clone and Install

### 1.1 Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd Eve

# Verify repository structure
ls -la
# You should see: admin/ backend/ driver/ rider/ www/ README.md
```

### 1.2 Install Root Dependencies

```bash
# Install root-level dependencies (Husky, Prettier, etc.)
npm install
```

This sets up:
- Git hooks for code quality
- Pre-commit linting
- Code formatting tools

## Step 2: Infrastructure Setup

Eve requires PostgreSQL, Redis, and (for the full event bus) Kafka. We'll use Docker for all three.

### 2.1 Start Infrastructure Services

```bash
cd backend

# Start PostgreSQL, Redis, and Kafka
docker compose up postgres redis kafka -d

# Verify services are running
docker compose ps
```

Expected output:
```
NAME            STATUS          PORTS
eve-postgres    Up 10 seconds   0.0.0.0:5432->5432/tcp
eve-redis       Up 10 seconds   0.0.0.0:6379->6379/tcp
eve-kafka       Up 10 seconds   0.0.0.0:9092->9092/tcp, 0.0.0.0:9094->9094/tcp
```

### 2.2 Verify Database Connection

```bash
# Test PostgreSQL connection
docker compose exec postgres psql -U eve -d eve -c "SELECT version();"

# Test Redis connection
docker compose exec redis redis-cli ping
# Expected: PONG
```

## Step 3: Backend Configuration

### 3.1 Create Environment File

```bash
# Ensure you're in the backend directory
cd backend

# Copy example environment file
cp .env.example .env
```

### 3.2 Configure Required Variables

Edit `backend/.env` and set these **required** variables:

```bash
# Database (default works for Docker setup)
DATABASE_URL=postgresql://eve:eve@localhost:5432/eve

# Redis (default works for Docker setup)
REDIS_URL=redis://localhost:6379

# JWT Secret (REQUIRED - generate a secure secret)
JWT_ACCESS_SECRET=<generate-a-long-random-secret>

# Privy Configuration (REQUIRED for mobile apps)
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
```

#### Generate Secure Secrets

```bash
# Generate JWT_ACCESS_SECRET
openssl rand -base64 32

# Generate PASSWORD_RESET_SECRET
openssl rand -base64 32

# Generate INTERNAL_SERVICE_SECRET
openssl rand -base64 48
```

Copy the generated values into your `.env` file.

### 3.3 Privy Setup (Optional for Backend Only)

If you want to test mobile apps, you'll need Privy:

1. Sign up at [dashboard.privy.io](https://dashboard.privy.io)
2. Create an app and two App Clients (rider and driver)
3. Enable SMS, passkeys, identity tokens, and Ethereum + Solana wallets
4. Copy App ID and secret to backend `.env`

**Note**: You can skip Privy for now and use the admin console with seeded users.

## Step 4: Database Setup

### 4.1 Install Backend Dependencies

```bash
# Still in backend directory
npm install
```

This may take 2-3 minutes for first-time install.

### 4.2 Generate Prisma Client

```bash
npm run db:generate
```

This creates the Prisma client from your schema.

### 4.3 Run Database Migrations

```bash
npm run db:migrate
```

This creates all database tables.

### 4.4 Seed the Database

```bash
npm run db:seed
```

This creates:
- Test users (riders, drivers, admin staff)
- Sample fare configurations
- Test markets and zones

**Seeded admin accounts** (password: `Admin123!`):
- owner@eve.local (OWNER role)
- ops@eve.local (OPERATIONS)
- finance@eve.local (FINANCE)
- support@eve.local (SUPPORT)
- safety@eve.local (SAFETY)

## Step 5: Start Backend Services

Run all six Node services:

```bash
# Still in backend directory
npm run dev
```

Expected output:
```
Auth service running on port 4001
Location service HTTP running on port 4002
Location gRPC server ready on port 50051
Ride service running on port 4003
Notify service HTTP running on port 4004
Admin service running on port 4005
Payment service running on port 4006
```

This starts six processes: auth :4001, location :4002, ride :4003, notify :4004, admin :4005, payment :4006.

Live Arc Testnet RideEscrow is documented in [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md) (`0xdE6f01794e74AfDbAd4C783123241285c1947f4C`). Set `ESCROW_CONTRACT_ADDRESS`, `ESCROW_OPERATOR_ADDRESS`, and `TREASURY_PRIVATE_KEY` in `backend/.env`, then restart payment. Rider and driver apps do **not** hardcode that address; they use `EXPO_PUBLIC_PAYMENT_URL` and `GET /api/payment/config`. Leave `LOAD_ESCROW` unset. Fund the rider Privy embedded wallet (and the operator) from [faucet.circle.com](https://faucet.circle.com) (Arc Testnet).

### 5.1 Verify Backend is Running

Open a new terminal and test the API:

```bash
curl http://localhost:4001/health
curl http://localhost:4003/health
curl http://localhost:4006/health
```

## Step 6: Admin Console Setup (optional)

The admin console lets you manage riders, drivers, trips, and pricing.

### 6.1 Install Admin Dependencies

```bash
# Open a new terminal
cd admin

# Install dependencies
npm install
```

### 6.2 Configure Admin Environment

```bash
# Copy environment file
cp .env.example .env.local

# Edit .env.local if needed (defaults work for local development)
```

Default `.env.local`:
```bash
NEXT_PUBLIC_API_URL=/api
AUTH_PROXY_TARGET=http://127.0.0.1:4001
RIDE_PROXY_TARGET=http://127.0.0.1:4003
NOTIFY_PROXY_TARGET=http://127.0.0.1:4004
ADMIN_PROXY_TARGET=http://127.0.0.1:4005
PAYMENT_PROXY_TARGET=http://127.0.0.1:4006
NEXT_PUBLIC_NOTIFY_URL=http://127.0.0.1:4004
```

### 6.3 Start Admin Console

```bash
npm run dev
```

Expected output:
```
▲ Next.js 16.x.x
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in X.Xs
```

### 6.4 Access Admin Console

1. Open http://localhost:3000
2. Login with:
   - Email: `owner@eve.local`
   - Password: `Admin123!`

You should see the admin dashboard!

## Step 7: Marketing Site Setup (optional)

The marketing site is a public landing page. It does not call the API.

### 7.1 Install and run

```bash
# Open a new terminal
cd www
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3020. Optionally set `NEXT_PUBLIC_GITHUB_URL` in `.env.local` so Docs and View source point at the public repository.

## Step 8: Mobile Apps Setup

Mobile apps require additional setup for Mapbox and Privy.

### Prerequisites for Mobile Development

- **Xcode** 15+ (for iOS) or **Android Studio** (for Android)
- **Privy app** configured
- **Mapbox account** for maps

### 8.1 Rider App Setup

```bash
cd rider

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and set:
# EXPO_PUBLIC_AUTH_URL=http://<YOUR_LAN_IP>:4001/api
# EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:4003/api
# EXPO_PUBLIC_PAYMENT_URL=http://<YOUR_LAN_IP>:4006/api
# EXPO_PUBLIC_WS_URL=http://<YOUR_LAN_IP>:4004
# EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
# EXPO_PUBLIC_PRIVY_CLIENT_ID=your-privy-client-id
# EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
# EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token
```

**Important**: Rider and driver apps are **not** in Docker. Backend Compose publishes ports; Expo and the emulator run on the host.

URL cheat sheet (backend already up via `npm run dev` or `docker compose up` from `backend/`):

| Client | Auth / Ride / Payment / Notify |
| --- | --- |
| iOS Simulator | `http://localhost:4001/api`, `:4003/api`, `:4006/api`, `:4004` |
| Android Emulator | `adb reverse` those four ports and use `localhost`, **or** `http://10.0.2.2:4001/api` (and `4003` / `4006` / `4004`) |
| Physical device | `http://<LAN_IP>:4001/api` (etc.) |

Do not put `ESCROW_CONTRACT_ADDRESS` in `rider/.env` or `driver/.env`. Apps load the live RideEscrow from `GET /api/payment/config`. After Privy login, fund the **embedded** Ethereum address at [faucet.circle.com](https://faucet.circle.com) (Arc Testnet). See [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md).

Find your LAN IP:
```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

### 8.2 Build Development Client

```bash
# iOS Simulator (macOS + Xcode)
npx expo run:ios

# Android Emulator (Android Studio AVD)
adb reverse tcp:4001 tcp:4001
adb reverse tcp:4003 tcp:4003
adb reverse tcp:4004 tcp:4004
npx expo run:android
```

This builds a development client with Privy and Mapbox integrated. After install, Metro can open the app with `i` / `a`. See [backend/docs/docker.md](backend/docs/docker.md) for emulator networking against Compose.

### 8.3 Driver App Setup

Same as rider app:

```bash
cd driver
npm install
cp .env.example .env
# Edit .env with same values
npx expo run:ios  # or run:android
```

For detailed mobile setup, see:
- [rider/README.md](rider/README.md)
- [driver/README.md](driver/README.md)
- [backend/docs/auth.md](backend/docs/auth.md)

## Verification

### Backend Verification

```bash
curl http://localhost:4001/health
curl http://localhost:4003/health

# Check database
cd backend
npx prisma studio
# Opens Prisma Studio at http://localhost:5555
```

### Admin Console Verification

1. Login to http://localhost:3000
2. Navigate to Dashboard → should show trip statistics
3. Navigate to Riders → should show seeded riders
4. Navigate to Drivers → should show seeded drivers

### Marketing Site Verification

1. Open http://localhost:3020
2. Hero, how-it-works, product, stack, and get-started sections should render
3. Nav anchors should scroll on the same page

### Services Verification

```bash
curl http://localhost:4001/health  # Auth
curl http://localhost:4002/health  # Location
curl http://localhost:4003/health  # Ride
curl http://localhost:4004/health  # Notify
curl http://localhost:4005/health  # Admin API
curl http://localhost:4006/health  # Payment
```

## Next Steps

Now that Eve is running:

1. **Explore the Admin Console**
   - Review the dashboard
   - Browse riders and drivers
   - Check fare configurations

2. **Read the Documentation**
   - [Architecture Overview](ARCHITECTURE.md)
   - [Backend Services](backend/docs/)
   - [Backend tests](backend/) (`npm test` in `backend/`, `rider/`, `driver/`)

3. **Run Tests**
   ```bash
   cd backend
   npm test
   ```

4. **Try Load Testing**
   ```bash
   cd backend
   npm run load:smoke
   ```

5. **Set Up Mobile Apps**
   - Configure Privy properly
   - Get Mapbox token
   - Build development clients

## Common Issues

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::4003`

**Solution**:
```bash
# Find process using the port
lsof -i :4003

# Kill the process
kill -9 <PID>
```

### Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**:
- Start Docker Desktop
- Wait for Docker to fully start (whale icon in menu bar)
- Try command again

### Database Connection Failed

**Error**: `Can't reach database server at localhost:5432`

**Solution**:
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Restart PostgreSQL
docker compose restart postgres

# Check logs
docker compose logs postgres
```

### Prisma Client Not Found

**Error**: `@prisma/client did not initialize yet`

**Solution**:
```bash
cd backend
npm run db:generate
```

### Module Not Found Errors

**Error**: `Cannot find module '...'`

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# In backend, also regenerate Prisma
npm run db:generate
```

### Privy Configuration Issues

**Error**: identity token unavailable or 401 on `/auth/privy`

**Solution**:
- Enable identity tokens, SMS, and passkeys in the Privy Dashboard
- Check `PRIVY_APP_ID` / `EXPO_PUBLIC_PRIVY_CLIENT_ID`
- See [backend/docs/auth.md](backend/docs/auth.md) for details

### Expo Development Client Issues

**Error**: `No development client found`

**Solution**:
```bash
# Rebuild development client
npx expo run:ios  # or run:android

# Clear cache
npx expo start --clear
```

### Hot Reload Not Working

**Solution**:
```bash
# Backend: tsx watch should auto-restart
# If not, restart npm run dev

# Next.js: Should auto-refresh
# If not, restart npm run dev

# Expo: Clear bundler cache
npx expo start --clear
```

For more troubleshooting, see [FAQ.md](FAQ.md).

## Getting Help

If you're stuck:

1. Check [FAQ.md](FAQ.md) for common solutions
2. Review error logs in terminal
3. Check Docker logs: `docker compose logs`
4. Verify all prerequisites are met
5. Try a clean install:
   ```bash
   # Backend
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   
   # Apps
   cd ../admin
   rm -rf node_modules package-lock.json
   npm install
   ```

## Summary

You should now have:

- ✅ PostgreSQL, Redis, and Kafka running in Docker
- ✅ Backend services on http://localhost:4001–4006
- ✅ Admin console running on http://localhost:3000
- ✅ (Optional) Marketing site on http://localhost:3020
- ✅ Database seeded with test data
- ✅ (Optional) Mobile apps running on iOS/Android

**Next**: Read the [Architecture Overview](ARCHITECTURE.md) to understand how Eve works.

---

**Last Updated**: 2026-09-06
