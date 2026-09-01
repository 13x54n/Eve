# ============================================
# Eve Backend Makefile
# ============================================
# Convenient shortcuts for Docker and development commands

.PHONY: help setup dev dev-build dev-down dev-logs dev-clean
.PHONY: prod prod-build prod-down prod-logs
.PHONY: test db-migrate db-seed db-studio
.PHONY: build-gateway build-auth build-location build-ride build-notify
.PHONY: health clean

# Default target
.DEFAULT_GOAL := help

# ============================================
# Help
# ============================================
help: ## Show this help message
	@echo "Eve Backend - Available Commands"
	@echo "================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================
# Development
# ============================================
setup: ## Interactive Docker setup
	@./docker-setup.sh

dev: ## Start development services with Docker
	docker compose up

dev-build: ## Build and start development services
	docker compose up --build

dev-down: ## Stop development services
	docker compose down

dev-logs: ## View development logs (all services)
	docker compose logs -f

dev-clean: ## Stop and remove all development containers and volumes
	docker compose down -v

# ============================================
# Production
# ============================================
prod: ## Start production services
	docker compose -f docker-compose.prod.yml up -d
	@echo "Waiting for services to be ready..."
	@sleep 10
	docker compose -f docker-compose.prod.yml exec gateway npx prisma migrate deploy
	@echo "Production services started!"

prod-build: ## Build production images
	docker compose -f docker-compose.prod.yml build

prod-down: ## Stop production services
	docker compose -f docker-compose.prod.yml down

prod-logs: ## View production logs
	docker compose -f docker-compose.prod.yml logs -f

# ============================================
# Testing
# ============================================
test: ## Run tests
	docker compose exec gateway npm test

test-coverage: ## Run tests with coverage
	docker compose exec gateway npm run test:coverage

test-regression: ## Run regression tests
	docker compose exec gateway npm run test:regression

# ============================================
# Database
# ============================================
db-migrate: ## Run database migrations
	docker compose exec gateway npx prisma migrate deploy

db-seed: ## Seed database
	docker compose exec gateway npm run db:seed

db-studio: ## Open Prisma Studio
	docker compose exec gateway npx prisma studio

db-generate: ## Generate Prisma Client
	docker compose exec gateway npx prisma generate

# ============================================
# Individual Service Builds
# ============================================
build-gateway: ## Build gateway service image
	docker build --target gateway -t eve-gateway:latest .

build-auth: ## Build auth service image
	docker build --target auth -t eve-auth:latest .

build-location: ## Build location service image
	docker build --target location -t eve-location:latest .

build-ride: ## Build ride service image
	docker build --target ride -t eve-ride:latest .

build-notify: ## Build notify service image
	docker build --target notify -t eve-notify:latest .

build-all: ## Build all service images
	@$(MAKE) build-gateway
	@$(MAKE) build-auth
	@$(MAKE) build-location
	@$(MAKE) build-ride
	@$(MAKE) build-notify

# ============================================
# Health & Monitoring
# ============================================
health: ## Check health of all services
	@echo "Checking service health..."
	@curl -sf http://localhost:4000/health && echo "✓ Gateway (4000)" || echo "✗ Gateway (4000)"
	@curl -sf http://localhost:4001/health && echo "✓ Auth (4001)" || echo "✗ Auth (4001)"
	@curl -sf http://localhost:4002/health && echo "✓ Location (4002)" || echo "✗ Location (4002)"
	@curl -sf http://localhost:4003/health && echo "✓ Ride (4003)" || echo "✗ Ride (4003)"
	@curl -sf http://localhost:4004/health && echo "✓ Notify (4004)" || echo "✗ Notify (4004)"

ps: ## Show running containers
	docker compose ps

stats: ## Show container resource usage
	docker stats

# ============================================
# Shell Access
# ============================================
shell-gateway: ## Open shell in gateway container
	docker compose exec gateway sh

shell-auth: ## Open shell in auth container
	docker compose exec auth sh

shell-postgres: ## Open PostgreSQL shell
	docker compose exec postgres psql -U eve -d eve

shell-redis: ## Open Redis CLI
	docker compose exec redis redis-cli

# ============================================
# Logs
# ============================================
logs-gateway: ## View gateway logs
	docker compose logs -f gateway

logs-auth: ## View auth logs
	docker compose logs -f auth

logs-location: ## View location logs
	docker compose logs -f location

logs-ride: ## View ride logs
	docker compose logs -f ride

logs-notify: ## View notify logs
	docker compose logs -f notify

logs-postgres: ## View PostgreSQL logs
	docker compose logs -f postgres

logs-redis: ## View Redis logs
	docker compose logs -f redis

# ============================================
# Cleanup
# ============================================
clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi all
	docker compose -f docker-compose.prod.yml down -v --rmi all

prune: ## Prune Docker system (careful!)
	docker system prune -af --volumes
