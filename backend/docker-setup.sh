#!/bin/bash

# ============================================
# Eve Backend Docker Quick Start Script
# ============================================
# This script helps you quickly set up and run the Eve backend with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Please install Docker from https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed: $(docker --version)"
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose is installed: $(docker compose version)"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        echo "Please start Docker"
        exit 1
    fi
    print_success "Docker daemon is running"
    
    echo ""
}

# Setup environment file
setup_env() {
    print_header "Setting Up Environment"
    
    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env file"
            return
        fi
    fi
    
    print_info "Creating .env file from .env.example"
    cp .env.example .env
    
    # Generate secrets
    print_info "Generating secure secrets..."
    JWT_SECRET=$(openssl rand -base64 32)
    PASSWORD_RESET_SECRET=$(openssl rand -base64 32)
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_SECRET|g" .env
        sed -i '' "s|PASSWORD_RESET_SECRET=.*|PASSWORD_RESET_SECRET=$PASSWORD_RESET_SECRET|g" .env
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=postgresql://eve:eve@postgres:5432/eve|g" .env
        sed -i '' "s|REDIS_URL=.*|REDIS_URL=redis://redis:6379|g" .env
    else
        # Linux
        sed -i "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_SECRET|g" .env
        sed -i "s|PASSWORD_RESET_SECRET=.*|PASSWORD_RESET_SECRET=$PASSWORD_RESET_SECRET|g" .env
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://eve:eve@postgres:5432/eve|g" .env
        sed -i "s|REDIS_URL=.*|REDIS_URL=redis://redis:6379|g" .env
    fi
    
    print_success ".env file created with secure secrets"
    echo ""
}

# Start services
start_services() {
    print_header "Starting Services"
    
    MODE=${1:-dev}
    
    if [ "$MODE" = "prod" ]; then
        print_info "Starting production services..."
        docker compose -f docker-compose.prod.yml up -d
    else
        print_info "Starting development services..."
        docker compose up -d
    fi
    
    print_success "Services started"
    echo ""
}

# Wait for services to be healthy
wait_for_services() {
    print_header "Waiting for Services to be Ready"
    
    print_info "Waiting for PostgreSQL..."
    timeout 60 bash -c 'until docker compose exec -T postgres pg_isready -U eve; do sleep 2; done' || {
        print_error "PostgreSQL did not become ready in time"
        exit 1
    }
    print_success "PostgreSQL is ready"
    
    print_info "Waiting for Redis..."
    timeout 60 bash -c 'until docker compose exec -T redis redis-cli ping | grep -q PONG; do sleep 2; done' || {
        print_error "Redis did not become ready in time"
        exit 1
    }
    print_success "Redis is ready"
    
    print_info "Waiting for services to start (this may take a minute)..."
    sleep 20
    
    echo ""
}

# Run migrations
run_migrations() {
    print_header "Running Database Migrations"
    
    print_info "Running Prisma migrations..."
    docker compose exec gateway npx prisma migrate deploy || {
        print_warning "Migrations may have already been run by the gateway startup"
    }
    
    print_success "Database is ready"
    echo ""
}

# Check service health
check_health() {
    print_header "Checking Service Health"
    
    services=("gateway:4000" "auth:4001" "location:4002" "ride:4003" "notify:4004")
    
    all_healthy=true
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        if curl -sf http://localhost:$port/health > /dev/null 2>&1; then
            print_success "$name is healthy (port $port)"
        else
            print_error "$name is not responding (port $port)"
            all_healthy=false
        fi
    done
    
    echo ""
    
    if $all_healthy; then
        print_success "All services are healthy!"
    else
        print_warning "Some services are not healthy. Check logs with: docker compose logs"
    fi
    
    echo ""
}

# Show service URLs
show_urls() {
    print_header "Service URLs"
    
    echo "Gateway API:      http://localhost:4000"
    echo "Auth Service:     http://localhost:4001"
    echo "Location Service: http://localhost:4002"
    echo "Ride Service:     http://localhost:4003"
    echo "Notify Service:   http://localhost:4004"
    echo ""
    echo "Health Check:     http://localhost:4000/health"
    echo ""
}

# Show helpful commands
show_commands() {
    print_header "Helpful Commands"
    
    echo "View logs (all):              docker compose logs -f"
    echo "View logs (specific):         docker compose logs -f gateway"
    echo "Stop services:                docker compose down"
    echo "Restart services:             docker compose restart"
    echo "Rebuild services:             docker compose up --build"
    echo ""
    echo "Run Prisma Studio:            docker compose exec gateway npx prisma studio"
    echo "Run tests:                    docker compose exec gateway npm test"
    echo "Access PostgreSQL:            docker compose exec postgres psql -U eve -d eve"
    echo "Access Redis CLI:             docker compose exec redis redis-cli"
    echo ""
}

# Main menu
main_menu() {
    print_header "Eve Backend Docker Setup"
    
    echo "Choose an option:"
    echo "1) Quick Start (Development)"
    echo "2) Start Production Services"
    echo "3) Stop All Services"
    echo "4) View Logs"
    echo "5) Check Service Health"
    echo "6) Clean Up (Remove all containers and volumes)"
    echo "7) Exit"
    echo ""
    read -p "Enter option (1-7): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            check_prerequisites
            setup_env
            start_services "dev"
            wait_for_services
            check_health
            show_urls
            show_commands
            ;;
        2)
            check_prerequisites
            setup_env
            start_services "prod"
            wait_for_services
            run_migrations
            check_health
            show_urls
            ;;
        3)
            print_info "Stopping all services..."
            docker compose down
            docker compose -f docker-compose.prod.yml down
            print_success "All services stopped"
            ;;
        4)
            print_info "Showing logs (press Ctrl+C to exit)..."
            docker compose logs -f
            ;;
        5)
            check_health
            ;;
        6)
            print_warning "This will remove all containers and volumes!"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker compose down -v
                docker compose -f docker-compose.prod.yml down -v
                print_success "Cleanup complete"
            fi
            ;;
        7)
            exit 0
            ;;
        *)
            print_error "Invalid option"
            exit 1
            ;;
    esac
}

# Run main menu
main_menu
