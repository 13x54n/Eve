# Frequently Asked Questions (FAQ)

Common questions and solutions for the Eve platform.

## Table of Contents

- [Setup and Installation](#setup-and-installation)
- [Backend Issues](#backend-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Mobile App Issues](#mobile-app-issues)
- [Docker Issues](#docker-issues)
- [Development Issues](#development-issues)
- [Production Issues](#production-issues)

## Setup and Installation

### Q: What are the minimum system requirements?

**A:** 
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 8GB minimum (16GB recommended)
- **Disk**: 10GB free space
- **OS**: macOS, Linux, or Windows with WSL2
- **Node.js**: 22.x or higher
- **Docker**: Latest Desktop version

### Q: Which ports need to be available?

**A:**
- `4000` - Gateway (required)
- `4001-4004` - Services (proxy mode only)
- `5432` - PostgreSQL (required)
- `6379` - Redis (required)
- `3000` - Admin console
- `3010` - Monitor dashboard
- `8081` - Expo dev server

Check ports:
```bash
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows
```

### Q: Do I need Auth0 to run the backend?

**A:** Not initially. You can:
- Run backend without Auth0 for testing
- Use seeded admin users (password-based)
- Add Auth0 later for mobile apps

Auth0 is **required** for rider and driver mobile apps.

### Q: Can I run Eve on Windows?

**A:** Yes, with some caveats:
- Use **WSL2** for best experience
- Or use **Docker Desktop for Windows**
- Native Windows support is limited

Recommended: WSL2 with Ubuntu 22.04.

### Q: How long does initial setup take?

**A:** 
- **Backend only**: 15-20 minutes
- **Backend + Admin**: 25-30 minutes
- **Full platform** (including mobile): 45-60 minutes

See [GETTING_STARTED.md](GETTING_STARTED.md) for complete walkthrough.

## Backend Issues

### Q: "Cannot connect to the database server at localhost:5432"

**A:** PostgreSQL is not running.

**Solution**:
```bash
# Check Docker
docker ps

# Start PostgreSQL
cd backend
docker compose up postgres -d

# Verify connection
docker compose exec postgres psql -U eve -d eve -c "SELECT 1;"
```

### Q: "Port 4000 is already in use"

**A:** Another process is using the port.

**Solution**:
```bash
# Find process
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port
PORT=4001 npm run dev
```

### Q: Backend starts but returns 500 errors

**A:** Check logs for specific errors:

```bash
# Check gateway logs
cd backend
npm run dev
# Look for error messages

# Common causes:
# 1. Missing environment variables
# 2. Database not migrated
# 3. Redis not running
```

**Solution**:
```bash
# 1. Verify .env file
cat .env | grep DATABASE_URL

# 2. Run migrations
npm run db:generate
npm run db:migrate

# 3. Check Redis
docker compose ps redis
```

### Q: "Prisma Client could not be found"

**A:** Prisma client not generated.

**Solution**:
```bash
cd backend
npm run db:generate

# If still fails, clean install
rm -rf node_modules package-lock.json
npm install
npm run db:generate
```

### Q: Module not found errors

**A:** Dependencies not installed or stale.

**Solution**:
```bash
cd backend  # or affected directory
rm -rf node_modules package-lock.json
npm install

# For workspaces
npm install --workspaces
```

### Q: Hot reload not working

**A:** `tsx watch` may not be detecting changes.

**Solution**:
```bash
# Restart dev server
# Ctrl+C to stop, then:
npm run dev

# Check file watchers limit (Linux)
cat /proc/sys/fs/inotify/max_user_watches
# Increase if low:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Database Issues

### Q: "relation 'User' does not exist"

**A:** Database not migrated.

**Solution**:
```bash
cd backend

# Check migration status
npx prisma migrate status

# Run migrations
npm run db:migrate

# If migrations are out of sync
npx prisma migrate reset  # WARNING: Drops all data
npm run db:seed
```

### Q: How do I reset the database?

**A:** 
```bash
cd backend

# Development only - drops all data!
npm run db:reset

# This will:
# 1. Drop all tables
# 2. Run migrations
# 3. Seed test data
```

⚠️ **Never** run this in production!

### Q: Database migration fails

**A:** Check for:
1. Conflicting migrations
2. Data that violates new schema
3. Database connection issues

**Solution**:
```bash
# View migration status
npx prisma migrate status

# Resolve failed migration
npx prisma migrate resolve --applied <migration_name>

# Or reset (dev only)
npx prisma migrate reset
```

### Q: How do I view database contents?

**A:** Use Prisma Studio:

```bash
cd backend
npm run db:studio
# Opens http://localhost:5555
```

Or use `psql`:
```bash
docker compose exec postgres psql -U eve -d eve
\dt  # List tables
SELECT * FROM "User";
```

### Q: Seed data not appearing

**A:** 
```bash
cd backend

# Run seed manually
npm run db:seed

# Check for errors in output
# Verify in Prisma Studio
npm run db:studio
```

## Authentication Issues

### Q: "Invalid callback URL" error in Auth0

**A:** Callback URLs in Auth0 dashboard don't match your configuration.

**Solution**:
1. Go to Auth0 Dashboard → Applications → Your App
2. Check **Allowed Callback URLs**
3. Must include:
   ```
   eve://YOUR_TENANT_DOMAIN/ios/ca.sherpafoods.eve/callback
   eve://YOUR_TENANT_DOMAIN/android/ca.sherpafoods.eve/callback
   evedriver://YOUR_TENANT_DOMAIN/ios/ca.sherpafoods.evedriver/callback
   evedriver://YOUR_TENANT_DOMAIN/android/ca.sherpafoods.evedriver/callback
   ```
4. **No `https://`**, no trailing slash
5. Save changes and try again

See [backend/docs/auth.md](backend/docs/auth.md) for details.

### Q: "JWT malformed" error

**A:** JWT token is invalid or expired.

**Solution**:
```bash
# Mobile app: Logout and login again
# The app will get a new token

# Backend: Check JWT_ACCESS_SECRET is set
cd backend
grep JWT_ACCESS_SECRET .env

# If missing, add it
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 32)" >> .env
```

### Q: Admin login not working

**A:** Check credentials and password hash.

**Solution**:
```bash
# Use seeded admin accounts
# Email: owner@eve.local
# Password: Admin123!

# Or create new admin
cd backend
npm run db:studio
# Add user in Prisma Studio
```

### Q: "AUTH0_DOMAIN must not include https://"

**A:** Remove protocol from Auth0 domain.

**Solution**:
```bash
# Bad
AUTH0_DOMAIN=https://tenant.us.auth0.com/

# Good
AUTH0_DOMAIN=tenant.us.auth0.com
```

## Mobile App Issues

### Q: "No development client found" in Expo

**A:** Auth0 requires a custom development client.

**Solution**:
```bash
cd rider  # or driver

# Build development client
npx expo run:ios  # or run:android

# Wait for build to complete, then:
npx expo start
```

### Q: App cannot connect to backend API

**A:** Using `localhost` instead of LAN IP.

**Solution**:
```bash
# Find your LAN IP
# macOS/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows:
ipconfig | findstr IPv4

# Update .env
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000/api
#                            ^^^^^^^^^^^^^^
#                            Your LAN IP

# Restart Metro bundler
npx expo start --clear
```

### Q: Metro bundler cache issues

**A:** 
```bash
cd rider  # or driver

# Clear cache and restart
npx expo start --clear

# If still broken, reset completely
rm -rf node_modules .expo package-lock.json
npm install
npx expo start --clear
```

### Q: "Unable to resolve module" errors

**A:** 
```bash
# Clear Metro cache
npx expo start --clear

# Clean reinstall
rm -rf node_modules
npm install

# Rebuild development client
npx expo run:ios  # or run:android
```

### Q: Auth0 login not working on mobile

**A:** Check:
1. Development client built (not using Expo Go)
2. Callback URLs configured correctly
3. Auth0 domain/client ID in `.env`
4. Metro bundler restarted after env changes

**Solution**:
```bash
# Rebuild dev client
npx expo run:ios  # or run:android

# Clear and restart
npx expo start --clear
```

### Q: Maps not showing (Mapbox)

**A:** Invalid or missing Mapbox token.

**Solution**:
```bash
# Check .env
grep EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN .env

# Get token from https://account.mapbox.com/
# Add to .env:
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here

# Restart Metro
npx expo start --clear
```

## Docker Issues

### Q: "Cannot connect to Docker daemon"

**A:** Docker Desktop not running.

**Solution**:
- **macOS**: Start Docker Desktop app
- **Linux**: `sudo systemctl start docker`
- **Windows**: Start Docker Desktop

Wait for Docker to fully start (whale icon in system tray).

### Q: Docker containers keep restarting

**A:** Check logs for errors:

```bash
cd backend
docker compose logs

# Specific service
docker compose logs gateway

# Common issues:
# - Missing environment variables
# - Port conflicts
# - Database connection failed
```

### Q: "No space left on device" in Docker

**A:** Docker ran out of disk space.

**Solution**:
```bash
# Clean up unused resources
docker system prune -a

# Remove unused volumes
docker volume prune

# Check disk usage
docker system df
```

### Q: Docker Compose file not found

**A:** Ensure you're in the correct directory:

```bash
cd backend  # Docker Compose files are here
docker compose up
```

### Q: Services can't communicate in Docker

**A:** Check network configuration:

```bash
# List networks
docker network ls

# Inspect network
docker network inspect backend_eve-network

# Recreate network
docker compose down
docker compose up -d
```

### Q: PostgreSQL container won't start

**A:** 
```bash
# Check logs
docker compose logs postgres

# Common issues:
# - Data directory corrupted
# - Port 5432 in use

# Solution: Remove volume and restart
docker compose down -v
docker compose up -d postgres
```

## Development Issues

### Q: ESLint errors blocking commits

**A:** Husky pre-commit hook enforcing code quality.

**Solution**:
```bash
# Fix auto-fixable issues
npm run lint -- --fix

# Format code
npm run format

# Then commit again
git add .
git commit -m "Your message"
```

### Q: How do I skip pre-commit hooks?

**A:** 
```bash
# Not recommended, but in emergencies:
git commit --no-verify -m "WIP"

# Better: Fix the issues
npm run lint -- --fix
npm run format
```

### Q: Tests failing locally

**A:** 
```bash
cd backend

# Check environment
echo $NODE_ENV  # Should be 'test' or empty

# Clean database
npm run db:reset

# Run tests
npm test

# Run specific test
npm test -- trip-lifecycle.test.ts
```

### Q: Can't push to Git - "pre-push hook failed"

**A:** Tests or linting failed.

**Solution**:
```bash
# Run tests locally
npm test

# Fix any failures
# Then push again
git push
```

### Q: VS Code TypeScript errors but code works

**A:** VS Code using wrong TypeScript version.

**Solution**:
1. Open a `.ts` file
2. Cmd+Shift+P (Ctrl+Shift+P on Windows)
3. "TypeScript: Select TypeScript Version"
4. Choose "Use Workspace Version"

## Production Issues

### Q: High memory usage in production

**A:** 
```bash
# Check container stats
docker stats

# Increase memory limits
# Edit docker-compose.prod.yml
services:
  gateway:
    deploy:
      resources:
        limits:
          memory: 2G

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

### Q: Database connection pool exhausted

**A:** Too many concurrent connections.

**Solution**:
```bash
# Increase connection pool in DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"

# Or use connection pooler (PgBouncer)
# Or add read replicas
```

### Q: Redis out of memory

**A:** 
```bash
# Check Redis memory
docker compose exec redis redis-cli INFO memory

# Solution 1: Increase Redis memory limit
# Edit redis.conf:
maxmemory 2gb

# Solution 2: Set eviction policy
maxmemory-policy allkeys-lru

# Restart Redis
docker compose restart redis
```

### Q: SSL certificate expired

**A:** 
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Check expiry
sudo certbot certificates

# Restart Nginx
sudo systemctl restart nginx
```

### Q: WebSocket connections dropping

**A:** Increase timeout in load balancer/Nginx:

```nginx
# /etc/nginx/sites-available/eve-api
location /socket.io/ {
    proxy_pass http://localhost:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;  # Add this
    proxy_send_timeout 3600s;  # Add this
}
```

### Q: API slow in production

**A:** Check:
1. Database query performance
2. Redis connection
3. Network latency
4. Resource limits

**Solution**:
```bash
# Enable Prisma query logging
DATABASE_URL="postgresql://...?log=query"

# Check Redis latency
docker compose exec redis redis-cli --latency

# Monitor resources
docker stats

# Scale services
docker compose -f docker-compose.prod.yml up -d --scale location=3
```

## Getting More Help

### Still Stuck?

1. **Check logs**:
   ```bash
   # Backend
   cd backend && npm run dev
   # Look for error messages
   
   # Docker
   docker compose logs -f
   ```

2. **Search existing issues**:
   - GitHub Issues
   - Stack Overflow
   - Auth0 Community

3. **Consult documentation**:
   - [Getting Started](GETTING_STARTED.md)
   - [Architecture](ARCHITECTURE.md)
   - [Backend Docs](backend/docs/)
   - [Security](SECURITY.md)

4. **Ask for help**:
   - Provide error messages
   - Include relevant logs
   - Describe steps to reproduce
   - Mention your environment (OS, Node version, etc.)

### Useful Commands

```bash
# Check versions
node --version
npm --version
docker --version

# Check services
curl http://localhost:4000/api/health
docker compose ps

# View logs
docker compose logs -f gateway
tail -f backend/logs/app.log

# Clean everything (dev only!)
docker compose down -v
rm -rf backend/node_modules
cd backend && npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

---

**Last Updated**: 2026-09-01
