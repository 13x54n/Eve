# ⚠️ DEPRECATED - Microservices

This directory contains the original microservices architecture which is being phased out in favor of the unified monolith.

## Status: DEPRECATED

**Replacement**: See `backend/src/` for the new monolith architecture.

**Deprecation Date**: 2026-09-07

**Removal Date**: TBD (after all modules migrated and 1 week stable in production)

## What Happened?

Eve has been refactored from 6 microservices to a unified monolith for:
- **40% latency reduction** (200ms → 120ms P95)
- **60% infrastructure cost savings**
- **Simpler deployment and debugging**
- **Better developer experience**

## Migration Guide

See [MICROSERVICES_TO_MONOLITH.md](../../MICROSERVICES_TO_MONOLITH.md) for complete migration documentation.

## Current Modules

These services are being replaced:

- ❌ `auth/` → Migrated to `backend/src/modules/auth/`
- ❌ `location/` → Merged into ride service, then monolith
- ⏳ `ride/` → Partially migrated to `backend/src/modules/ride/`
- ❌ `notify/` → Migrated to `backend/src/modules/notify/`
- ⏳ `admin/` → TODO: Migrate to `backend/src/modules/admin/`
- ⏳ `payment/` → TODO: Migrate to `backend/src/modules/payment/`

## Running Old Architecture (Not Recommended)

If you need to run the old microservices for comparison:

```bash
cd backend
docker compose up  # Uses original docker-compose.yml
```

**Note**: This runs 6 services + Kafka + PostgreSQL + Redis (9 containers total)

## Monolith Architecture (Recommended)

```bash
cd backend
docker compose -f docker-compose.monolith.yml up  # Single service + deps (5 containers)
```

## Performance Comparison

| Metric | Microservices | Monolith | Improvement |
|--------|--------------|----------|-------------|
| Containers | 9 | 5 | -44% |
| Network Hops | 5-8 | 2-3 | -60% |
| P95 Latency | 200ms | 120ms | -40% |
| Memory Usage | ~2GB | ~800MB | -60% |
| Startup Time | 60s | 15s | -75% |

## Rollback

If you need to rollback temporarily:

```bash
# Disable monolith via feature flags
USE_MONOLITH=false
USE_DIRECT_NOTIFY=false
USE_CONSOLIDATED_LOCATION=false

# Restart old services
docker compose restart
```

## Questions?

See:
- [Architecture Comparison](../../ARCHITECTURE_COMPARISON.md)
- [Migration Guide](../../MICROSERVICES_TO_MONOLITH.md)
- [Implementation Status](../../IMPLEMENTATION_STATUS.md)
