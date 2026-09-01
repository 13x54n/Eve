# ============================================
# Production Multi-Stage Dockerfile
# ============================================
# This Dockerfile builds optimized production images for all services
# Usage: docker build --target <service> -t eve-<service>:latest .
# Services: gateway, auth, location, ride, notify

# ============================================
# Stage 1: Base Dependencies
# ============================================
FROM node:22-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/http/package.json ./packages/http/
COPY services/auth/package.json ./services/auth/
COPY services/location/package.json ./services/location/
COPY services/ride/package.json ./services/ride/
COPY services/notify/package.json ./services/notify/
COPY gateway/package.json ./gateway/

# ============================================
# Stage 2: Install Dependencies
# ============================================
FROM base AS dependencies

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code and Prisma schema
COPY . .

# Generate Prisma Client with a dummy DATABASE_URL
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# ============================================
# Stage 3: Build
# ============================================
FROM dependencies AS build

# Build all packages and services
RUN npm run build

# ============================================
# Stage 4: Production Dependencies
# ============================================
FROM base AS prod-dependencies

# Install only production dependencies
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY prisma.config.ts ./
COPY packages/db/src/schema.prisma ./packages/db/src/
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# ============================================
# Stage 5: Gateway Service
# ============================================
FROM node:22-slim AS gateway

RUN apt-get update -y && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=prod-dependencies /app/packages ./packages

# Copy built gateway
COPY --from=build /app/gateway/dist ./gateway/dist
COPY --from=build /app/gateway/package.json ./gateway/

# Copy Prisma generated client
COPY --from=prod-dependencies /app/packages/db/src/generated ./packages/db/src/generated

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "gateway/dist/server.js"]

# ============================================
# Stage 6: Auth Service
# ============================================
FROM node:22-slim AS auth

RUN apt-get update -y && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=prod-dependencies /app/packages ./packages

# Copy built service
COPY --from=build /app/services/auth/dist ./services/auth/dist
COPY --from=build /app/services/auth/package.json ./services/auth/

# Copy Prisma generated client
COPY --from=prod-dependencies /app/packages/db/src/generated ./packages/db/src/generated

ENV NODE_ENV=production
ENV AUTH_PORT=4001

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "services/auth/dist/server.js"]

# ============================================
# Stage 7: Location Service
# ============================================
FROM node:22-slim AS location

RUN apt-get update -y && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=prod-dependencies /app/packages ./packages

# Copy built service
COPY --from=build /app/services/location/dist ./services/location/dist
COPY --from=build /app/services/location/package.json ./services/location/

# Copy Prisma generated client
COPY --from=prod-dependencies /app/packages/db/src/generated ./packages/db/src/generated

ENV NODE_ENV=production
ENV LOCATION_PORT=4002

EXPOSE 4002

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "services/location/dist/server.js"]

# ============================================
# Stage 8: Ride Service
# ============================================
FROM node:22-slim AS ride

RUN apt-get update -y && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=prod-dependencies /app/packages ./packages

# Copy built service
COPY --from=build /app/services/ride/dist ./services/ride/dist
COPY --from=build /app/services/ride/package.json ./services/ride/

# Copy Prisma generated client
COPY --from=prod-dependencies /app/packages/db/src/generated ./packages/db/src/generated

ENV NODE_ENV=production
ENV RIDE_PORT=4003

EXPOSE 4003

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4003/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "services/ride/dist/server.js"]

# ============================================
# Stage 9: Notify Service
# ============================================
FROM node:22-slim AS notify

RUN apt-get update -y && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=prod-dependencies /app/packages ./packages

# Copy built service
COPY --from=build /app/services/notify/dist ./services/notify/dist
COPY --from=build /app/services/notify/package.json ./services/notify/

# Copy Prisma generated client
COPY --from=prod-dependencies /app/packages/db/src/generated ./packages/db/src/generated

ENV NODE_ENV=production
ENV NOTIFY_PORT=4004

EXPOSE 4004

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4004/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "services/notify/dist/server.js"]
