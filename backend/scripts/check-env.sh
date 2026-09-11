#!/bin/bash
# ============================================
# Environment Variable Validation Script
# ============================================
# Checks if required environment variables are set before starting services
# Usage: ./scripts/check-env.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required environment variables
REQUIRED_VARS=(
  "JWT_ACCESS_SECRET"
  "DATABASE_URL"
  "INTERNAL_SERVICE_SECRET"
  "AUTH0_DOMAIN"
  "AUTH0_CLIENT_ID"
)

# Optional but recommended for production
RECOMMENDED_VARS=(
  "REDIS_URL"
  "LOCATION_GRPC_PORT"
  "LOCATION_GRPC_URL"
  "NOTIFY_GRPC_PORT"
  "NOTIFY_GRPC_URL"
)

echo "============================================"
echo "Environment Variable Validation"
echo "============================================"
echo ""

# Check required variables
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING+=("$var")
  fi
done

# Report missing required variables
if [ ${#MISSING[@]} -ne 0 ]; then
  echo -e "${RED}ERROR: Missing REQUIRED environment variables:${NC}"
  for var in "${MISSING[@]}"; do
    echo -e "  ${RED}✗${NC} $var"
  done
  echo ""
  echo "These variables are required for the services to start."
  echo "Create a .env file from .env.example and fill in the values:"
  echo ""
  echo "  cp .env.example .env"
  echo "  # Edit .env and set the required values"
  echo ""
  exit 1
fi

# Report all required variables are set
echo -e "${GREEN}✓ All REQUIRED environment variables are set${NC}"
for var in "${REQUIRED_VARS[@]}"; do
  # Don't print secret values
  echo -e "  ${GREEN}✓${NC} $var"
done
echo ""

# Check recommended variables
MISSING_RECOMMENDED=()
for var in "${RECOMMENDED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_RECOMMENDED+=("$var")
  fi
done

# Report missing recommended variables
if [ ${#MISSING_RECOMMENDED[@]} -ne 0 ]; then
  echo -e "${YELLOW}WARNING: Missing RECOMMENDED environment variables:${NC}"
  for var in "${MISSING_RECOMMENDED[@]}"; do
    echo -e "  ${YELLOW}⚠${NC} $var"
  done
  echo ""
  echo "These variables are recommended for proper service operation."
  echo "Some features may not work without them."
  echo ""
fi

# Check for default/insecure values in production
if [ "$NODE_ENV" = "production" ]; then
  echo "Checking for insecure default values in production..."
  
  INSECURE=()
  
  if [[ "$JWT_ACCESS_SECRET" == *"dev-jwt-secret"* ]] || [[ "$JWT_ACCESS_SECRET" == *"change-in-production"* ]]; then
    INSECURE+=("JWT_ACCESS_SECRET contains default value")
  fi
  
  if [[ "$INTERNAL_SERVICE_SECRET" == *"dev-internal-secret"* ]] || [[ "$INTERNAL_SERVICE_SECRET" == *"change-in-production"* ]]; then
    INSECURE+=("INTERNAL_SERVICE_SECRET contains default value")
  fi
  
  if [[ "$AUTH0_DOMAIN" == "example.us.auth0.com" ]]; then
    INSECURE+=("AUTH0_DOMAIN contains example value")
  fi
  
  if [[ "$AUTH0_CLIENT_ID" == "dev-auth0-client-id"* ]]; then
    INSECURE+=("AUTH0_CLIENT_ID contains example value")
  fi
  
  if [ ${#INSECURE[@]} -ne 0 ]; then
    echo -e "${RED}ERROR: Insecure default values detected in PRODUCTION:${NC}"
    for issue in "${INSECURE[@]}"; do
      echo -e "  ${RED}✗${NC} $issue"
    done
    echo ""
    echo "Generate secure secrets with: openssl rand -base64 32"
    echo ""
    exit 1
  fi
  
  echo -e "${GREEN}✓ No insecure default values detected${NC}"
  echo ""
fi

echo -e "${GREEN}Environment validation passed!${NC}"
echo ""
