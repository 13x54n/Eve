# Docker Setup Guide

This guide covers the complete Docker setup for the Eve backend microservices, including development and production configurations.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Development Setup](#development-setup)
5. [Production Setup](#production-setup)
6. [Building Individual Services](#building-individual-services)
7. [Environment Variables](#environment-variables)
8. [Service Architecture](#service-architecture)
9. [Health Checks](#health-checks)
10. [Troubleshooting](#troubleshooting)
11. [Advanced Usage](#advanced-usage)

---

## Overview

The Eve backend consists of 5 microservices running on Node.js 22:

- **Gateway** (port 4000): Main API entry point, routes to all services
- **Auth** (port 4001): Authentication, registration, password reset
- **Location** (port 4002): Driver presence and Redis-based geospatial matchmaking
- **Ride** (port 4003): Trip lifecycle, matching, offers
- **Notify** (port 4004): Notifications and Socket.IO real-time updates

Plus two infrastructure services:
- **PostgreSQL 16**: Primary database
- **Redis 7**: Geospatial indexing and caching

---

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- 8GB RAM minimum (16GB recommended for all services)
- 10GB free disk space

Verify installation:

```bash
docker --version
docker compose version
```

---

## Quick Start

### For Development (with hot-reload):

```bash
# 1. Navigate to backend directory
cd backend

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env and set required secrets
nano .env  # or your preferred editor

# 4. Start all services
docker compose up

# Gateway will be available at http://localhost:4000
# Individual services at their respective ports (4001-4004)
```

The gateway automatically runs database migrations on startup.

To seed the database, run this from the `backend/` directory after the gateway is running:

```bash
npm run db:seed:docker
```

### Stop services:

```bash
docker compose down
```

### Stop and remove volumes (full cleanup):

```bash
docker compose down -v
```

---

## Development Setup

### Architecture

The development setup uses:
- `Dockerfile.dev`: Node 22 with hot-reload support
- `docker-compose.yml`: All services with volume mounts for live code updates
- **tsx watch**: TypeScript execution with automatic restart on file changes

### Running Services

Start all services:

```bash
docker compose up
```

Start with rebuild (if you changed dependencies):

```bash
docker compose up --build
```

Run in detached mode (background):

```bash
docker compose up -d
```

### View Logs

All services:

```bash
docker compose logs -f
```

Specific service:

```bash
docker compose logs -f gateway
docker compose logs -f auth
docker compose logs -f location
```

### Running Database Commands

Access Prisma CLI through the gateway container:

```bash
# Generate Prisma Client
docker compose exec gateway npx prisma generate

# Run migrations
docker compose exec gateway npx prisma migrate dev

# Open Prisma Studio
docker compose exec gateway npx prisma studio

# Seed database
docker compose exec gateway npm run db:seed
```

### Running Tests

```bash
# Run tests in gateway container
docker compose exec gateway npm test

# Run with coverage
docker compose exec gateway npm run test:coverage
```

### Accessing Services Directly

Connect to a container shell:

```bash
docker compose exec gateway sh
docker compose exec auth sh
docker compose exec postgres psql -U eve -d eve
docker compose exec redis redis-cli
```

---

## Production Setup

### Architecture

The production setup uses:
- `Dockerfile`: Multi-stage builds with optimized images (~150-200MB per service)
- `docker-compose.prod.yml`: Production configuration with resource limits
- Compiled JavaScript (no tsx/TypeScript at runtime)
- Health checks and automatic restarts
- Log rotation

### Building Production Images

Build all services:

```bash
docker compose -f docker-compose.prod.yml build
```

Build specific service:

```bash
docker compose -f docker-compose.prod.yml build gateway
docker compose -f docker-compose.prod.yml build auth
```

Build with no cache (clean build):

```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

### Running Production Stack

1. Create production environment file:

```bash
cp .env.example .env.prod
```

2. Edit `.env.prod` with production values:
   - Generate strong JWT secrets: `openssl rand -base64 32`
   - Set production database credentials
   - Configure SMTP and ImageKit

3. Start services:

```bash
docker compose -f docker-compose.prod.yml up -d
```

4. Run migrations:

```bash
docker compose -f docker-compose.prod.yml exec gateway npx prisma migrate deploy
```

### Monitoring Production Services

View status:

```bash
docker compose -f docker-compose.prod.yml ps
```

View resource usage:

```bash
docker stats
```

Check health:

```bash
curl http://localhost:4000/health
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health
```

---

## Building Individual Services

You can build and run individual services using the multi-stage Dockerfile:

### Build specific service:

```bash
# Gateway
docker build --target gateway -t eve-gateway:latest .

# Auth
docker build --target auth -t eve-auth:latest .

# Location
docker build --target location -t eve-location:latest .

# Ride
docker build --target ride -t eve-ride:latest .

# Notify
docker build --target notify -t eve-notify:latest .
```

### Run individual service:

```bash
docker run -p 4000:4000 \
  -e DATABASE_URL=postgresql://eve:eve@host.docker.internal:5432/eve \
  -e JWT_ACCESS_SECRET=your-secret \
  --name eve-gateway \
  eve-gateway:latest
```

### Push to registry:

```bash
# Tag for your registry
docker tag eve-gateway:latest your-registry.com/eve-gateway:v1.0.0

# Push
docker push your-registry.com/eve-gateway:v1.0.0
```

---

## Environment Variables

### Required Variables

These must be set for the application to run:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_ACCESS_SECRET`: Secret for JWT access tokens
- `PASSWORD_RESET_SECRET`: Secret for password reset tokens

### Service-Specific Variables

**Gateway:**
- `PORT`: Gateway port (default: 4000)
- `GATEWAY_MODE`: `compose` or `proxy` (use `proxy` in Docker)
- `AUTH_URL`, `LOCATION_URL`, `RIDE_URL`, `NOTIFY_URL`: Service URLs

**Individual Services:**
- `AUTH_PORT`, `LOCATION_PORT`, `RIDE_PORT`, `NOTIFY_PORT`: Service ports

**Location Service:**
- `REDIS_URL`: Redis connection string
- `MATCH_RADIUS_KM`: Matchmaking radius in km (default: 25)

**Ride Service:**
- `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`: For driver photo uploads
- `IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_DRIVER_FOLDER`

See [`.env.example`](./.env.example) for complete list with descriptions.

---

## Service Architecture

### Service Communication

```
Client → Gateway (4000) → Auth (4001)
                        → Location (4002)
                        → Ride (4003) → Location
                                      → Notify (4004)
                        → Notify

All services → PostgreSQL (5432)
Location, Ride → Redis (6379)
```

### Gateway Modes

1. **Compose Mode** (`GATEWAY_MODE=compose`):
   - All services run in a single Node process
   - Faster for development
   - Not recommended in Docker

2. **Proxy Mode** (`GATEWAY_MODE=proxy`):
   - Gateway proxies to separate service processes
   - Better for scaling and isolation
   - **Recommended for Docker**

### Docker Networking

All services run in the `eve-network` bridge network. Services communicate using container names as hostnames:

- `http://auth:4001`
- `http://location:4002`
- `postgres:5432`
- `redis:6379`

---

## Health Checks

All services expose a `/health` endpoint for monitoring.

### Check Service Health

```bash
# All services
for port in 4000 4001 4002 4003 4004; do
  echo "Checking port $port..."
  curl -f http://localhost:$port/health && echo " ✓" || echo " ✗"
done
```

### Docker Health Checks

Services have built-in Docker health checks:

```bash
docker compose ps
# HEALTHY/UNHEALTHY status shows health check results
```

Health checks run every 30 seconds with:
- 3 second timeout
- 10 second start period
- 3 retries before marking unhealthy

---

## Troubleshooting

### Services won't start

**Check logs:**
```bash
docker compose logs
```

**Common issues:**
- Missing `.env` file → Copy from `.env.example`
- Port conflicts → Check if ports 4000-4004, 5432, 6379 are free
- Insufficient memory → Increase Docker memory limit to 8GB+

### Database connection errors

Inside a container, `localhost` / `127.0.0.1` refers to that container — not the Postgres service. Use the Compose service hostname `postgres` when running Prisma inside Docker.

**Verify the gateway container has the correct URL:**
```bash
docker compose exec gateway printenv DATABASE_URL
# Expected: postgresql://eve:eve@postgres:5432/eve
```

**Seed from Docker (recommended):**
```bash
npm run db:seed:docker
# Equivalent: docker compose exec gateway npm run db:seed
# Equivalent: make db-seed
```

**Seed from the host** (Postgres port 5432 published to localhost):
```bash
cd backend
npm run db:seed
```

Your `backend/.env` should use `DATABASE_URL=postgresql://eve:eve@localhost:5432/eve` for host-native commands. Docker Compose overrides this to `@postgres:5432` for service containers.

**Check PostgreSQL is running:**
```bash
docker compose ps postgres
```

**Test connection:**
```bash
docker compose exec postgres psql -U eve -d eve -c "SELECT 1;"
```

**Reset database:**
```bash
docker compose down -v
docker compose up -d postgres
docker compose exec gateway npx prisma migrate deploy
docker compose exec gateway npm run db:seed
```

### Prisma Client not found

**Regenerate Prisma Client:**
```bash
docker compose exec gateway npx prisma generate
```

**Rebuild containers:**
```bash
docker compose down
docker compose up --build
```

### Hot-reload not working

**Ensure volume mounts are correct:**
```bash
docker compose config
```

**Restart specific service:**
```bash
docker compose restart gateway
```

### Redis connection issues

**Check Redis is running:**
```bash
docker compose exec redis redis-cli ping
# Should return: PONG
```

**View Redis logs:**
```bash
docker compose logs redis
```

### Service returns 502/503 errors

**Check service dependencies:**
```bash
docker compose ps
```

Ensure all dependent services are healthy before the service starts.

**Check service logs:**
```bash
docker compose logs <service-name>
```

### High memory usage

**Check resource usage:**
```bash
docker stats
```

**Restart services:**
```bash
docker compose restart
```

**Production**: Resource limits are set in `docker-compose.prod.yml`

---

## Advanced Usage

### Running Specific Services

Run only infrastructure:
```bash
docker compose up postgres redis
```

Run gateway with infrastructure:
```bash
docker compose up postgres redis gateway
```

### Scaling Services

Scale location service to 3 instances:
```bash
docker compose up -d --scale location=3
```

**Note**: You'll need a load balancer and remove port mappings for scaling to work properly.

### Custom Network Configuration

Edit `docker-compose.yml` to use an external network:

```yaml
networks:
  eve-network:
    external: true
    name: your-network-name
```

### Volume Management

List volumes:
```bash
docker volume ls
```

Inspect volume:
```bash
docker volume inspect backend_postgres_data
```

Backup PostgreSQL data:
```bash
docker compose exec postgres pg_dump -U eve eve > backup.sql
```

Restore PostgreSQL data:
```bash
docker compose exec -T postgres psql -U eve eve < backup.sql
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
- name: Build and test
  run: |
    cd backend
    cp .env.example .env
    docker compose up -d
    docker compose exec -T gateway npm test
    docker compose down
```

**Build for multiple architectures:**
```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  --target gateway -t eve-gateway:latest .
```

### Kubernetes Deployment

The production Dockerfile is Kubernetes-ready. Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: eve-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: eve-gateway
  template:
    metadata:
      labels:
        app: eve-gateway
    spec:
      containers:
      - name: gateway
        image: your-registry.com/eve-gateway:latest
        ports:
        - containerPort: 4000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: eve-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 30
```

### AWS ECS/Fargate

The production images work with ECS task definitions. Use AWS Systems Manager Parameter Store for secrets.

### Monitoring and Observability

**Integrate with Prometheus:**

Add to `docker-compose.yml`:
```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"
```

**Centralized logging with Loki:**

Add to `docker-compose.yml`:
```yaml
loki:
  image: grafana/loki
  ports:
    - "3100:3100"

promtail:
  image: grafana/promtail
  volumes:
    - /var/lib/docker/containers:/var/lib/docker/containers
```

---

## Migration from PM2 to Docker

If you're currently using PM2 on EC2:

### 1. Build production images

```bash
docker compose -f docker-compose.prod.yml build
```

### 2. Push to container registry

```bash
# AWS ECR example
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com

docker tag eve-gateway:latest your-account.dkr.ecr.us-east-1.amazonaws.com/eve-gateway:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/eve-gateway:latest
```

### 3. Update deployment workflow

Replace PM2 commands in `.github/workflows/deploy.yml` with Docker commands:

```yaml
script: |
  cd ~/Eve/backend
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d
  docker compose -f docker-compose.prod.yml exec gateway npx prisma migrate deploy
```

---

## Performance Tips

1. **Use BuildKit** for faster builds:
   ```bash
   export DOCKER_BUILDKIT=1
   docker compose build
   ```

2. **Layer caching**: Don't change package.json frequently

3. **Multi-stage builds**: Already optimized in `Dockerfile`

4. **Volume performance on Mac/Windows**: Use named volumes instead of bind mounts for `node_modules`

5. **Resource limits**: Set appropriate limits in production to prevent one service from consuming all resources

---

## Security Best Practices

1. **Never commit `.env` files** - use `.env.example` as template

2. **Use strong secrets** in production:
   ```bash
   openssl rand -base64 32
   ```

3. **Run as non-root user** (already configured in Dockerfile.dev)

4. **Keep images updated**:
   ```bash
   docker compose pull
   docker compose up -d
   ```

5. **Scan images for vulnerabilities**:
   ```bash
   docker scan eve-gateway:latest
   ```

6. **Use Docker secrets** for sensitive data in production

7. **Enable TLS** for external connections

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Prisma in Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

## Support

For issues or questions:
1. Check logs: `docker compose logs`
2. Verify environment variables in `.env`
3. Ensure all prerequisites are met
4. Review troubleshooting section above

---

**Last Updated**: 2026-09-01
