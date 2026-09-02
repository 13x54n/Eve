# Deployment Guide

> This document still describes an older gateway-based deploy. Alpha local development uses five Node services (`npm run dev` from `backend/`) with no HTTP gateway. Do not treat Kubernetes/Compose diagrams here as the current alpha stack.

This guide covers production deployment options for the Eve platform.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Docker Compose Production](#docker-compose-production)
- [Kubernetes Deployment](#kubernetes-deployment)
- [AWS Deployment](#aws-deployment)
- [Database Management](#database-management)
- [Secrets Management](#secrets-management)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [CI/CD Pipeline](#cicd-pipeline)
- [Health Checks](#health-checks)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Overview

Eve can be deployed in several configurations:
- **Docker Compose**: Simple, single-server deployment
- **Kubernetes**: Container orchestration for high availability
- **AWS ECS/Fargate**: Managed containers on AWS
- **Traditional VMs**: PM2 process manager (legacy)

## Prerequisites

### Infrastructure Requirements

**Minimum**:
- 2 CPU cores
- 4GB RAM
- 20GB disk space
- Ubuntu 22.04 LTS or similar

**Recommended**:
- 4+ CPU cores
- 8GB+ RAM
- 50GB+ SSD storage
- Load balancer
- Managed PostgreSQL
- Managed Redis

### Software Requirements

- Docker Engine 20.10+
- Docker Compose v2.0+
- PostgreSQL 16 (managed or self-hosted)
- Redis 7 (managed or self-hosted)
- (Optional) Kubernetes 1.28+

### Domain and SSL

- Domain name configured
- SSL certificate (Let's Encrypt recommended)
- DNS records pointing to your server/load balancer

### External Services

- Auth0 tenant (production)
- Mapbox account
- ImageKit account
- Email provider (SendGrid, AWS SES, etc.)

## Docker Compose Production

Recommended for small to medium deployments (up to 10,000 concurrent users).

### Step 1: Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker
docker --version
docker compose version
```

### Step 2: Clone and Configure

```bash
# Clone repository
git clone <repository-url>
cd Eve/backend

# Create production environment file
cp .env.example .env.prod

# Edit with production values
nano .env.prod
```

**Required values** (see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)):
- Strong `JWT_ACCESS_SECRET` (64+ chars)
- Production `DATABASE_URL`
- Production `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID`
- `INTERNAL_SERVICE_SECRET` (96+ chars)
- ImageKit credentials
- SMTP configuration

### Step 3: Build Production Images

```bash
# Build all services
docker compose -f docker-compose.prod.yml build

# Or build specific service
docker compose -f docker-compose.prod.yml build gateway
```

### Step 4: Deploy Services

```bash
# Start infrastructure first
docker compose -f docker-compose.prod.yml up -d postgres redis

# Wait for database to be ready
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U eve

# Run migrations
docker compose -f docker-compose.prod.yml run --rm gateway npx prisma migrate deploy

# Start all services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### Step 5: Verify Deployment

```bash
# Check service health
curl http://localhost:4000/api/health
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health

# Check container status
docker compose -f docker-compose.prod.yml ps
```

### Step 6: Configure Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/eve-api
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/eve-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.example.com

# Auto-renewal is configured by default
sudo certbot renew --dry-run
```

## Kubernetes Deployment

For high availability and automatic scaling.

### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or self-managed)
- kubectl configured
- Helm 3 installed
- Container registry (ECR, GCR, Docker Hub)

### Step 1: Build and Push Images

```bash
# Login to your container registry
docker login your-registry.com

# Build and tag images
docker build --target gateway -t your-registry.com/eve-gateway:v1.0.0 .
docker build --target auth -t your-registry.com/eve-auth:v1.0.0 .
docker build --target location -t your-registry.com/eve-location:v1.0.0 .
docker build --target ride -t your-registry.com/eve-ride:v1.0.0 .
docker build --target notify -t your-registry.com/eve-notify:v1.0.0 .

# Push images
docker push your-registry.com/eve-gateway:v1.0.0
docker push your-registry.com/eve-auth:v1.0.0
docker push your-registry.com/eve-location:v1.0.0
docker push your-registry.com/eve-ride:v1.0.0
docker push your-registry.com/eve-notify:v1.0.0
```

### Step 2: Create Kubernetes Secrets

```bash
# Create namespace
kubectl create namespace eve-production

# Create secrets
kubectl create secret generic eve-secrets -n eve-production \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-access-secret="..." \
  --from-literal=auth0-domain="..." \
  --from-literal=auth0-client-id="..." \
  --from-literal=internal-service-secret="..."

# Create ImageKit secrets
kubectl create secret generic imagekit-secrets -n eve-production \
  --from-literal=private-key="..." \
  --from-literal=public-key="..." \
  --from-literal=url-endpoint="..."
```

### Step 3: Deploy PostgreSQL and Redis

**Option A: Managed Services** (Recommended)
- Use AWS RDS for PostgreSQL
- Use AWS ElastiCache for Redis

**Option B: Deploy in Kubernetes**

```yaml
# postgres-deployment.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: eve-production
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: eve-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        env:
        - name: POSTGRES_DB
          value: eve
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: eve-production
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### Step 4: Deploy Eve Services

```yaml
# gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
  namespace: eve-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
    spec:
      containers:
      - name: gateway
        image: your-registry.com/eve-gateway:v1.0.0
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "4000"
        - name: GATEWAY_MODE
          value: proxy
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: eve-secrets
              key: database-url
        - name: JWT_ACCESS_SECRET
          valueFrom:
            secretKeyRef:
              name: eve-secrets
              key: jwt-access-secret
        - name: AUTH_URL
          value: http://auth:4001
        - name: LOCATION_URL
          value: http://location:4002
        - name: RIDE_URL
          value: http://ride:4003
        - name: NOTIFY_URL
          value: http://notify:4004
        ports:
        - containerPort: 4000
        livenessProbe:
          httpGet:
            path: /api/health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: gateway
  namespace: eve-production
spec:
  type: LoadBalancer
  selector:
    app: gateway
  ports:
  - port: 4000
    targetPort: 4000
```

Apply deployments:
```bash
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f gateway-deployment.yaml
kubectl apply -f auth-deployment.yaml
kubectl apply -f location-deployment.yaml
kubectl apply -f ride-deployment.yaml
kubectl apply -f notify-deployment.yaml

# Check status
kubectl get pods -n eve-production
kubectl get services -n eve-production
```

### Step 5: Configure Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: eve-ingress
  namespace: eve-production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/websocket-services: "gateway"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.example.com
    secretName: eve-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway
            port:
              number: 4000
```

## AWS Deployment

### Using AWS ECS/Fargate

1. **Create ECR Repositories**
```bash
aws ecr create-repository --repository-name eve-gateway
aws ecr create-repository --repository-name eve-auth
aws ecr create-repository --repository-name eve-location
aws ecr create-repository --repository-name eve-ride
aws ecr create-repository --repository-name eve-notify
```

2. **Push Images to ECR**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker tag eve-gateway:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/eve-gateway:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/eve-gateway:latest
```

3. **Create RDS PostgreSQL Instance**
- Engine: PostgreSQL 16
- Instance class: db.t3.medium (minimum)
- Storage: 50GB gp3
- Enable automatic backups
- Multi-AZ for production

4. **Create ElastiCache Redis Cluster**
- Engine: Redis 7
- Node type: cache.t3.medium (minimum)
- Number of replicas: 1+

5. **Create ECS Task Definitions**
- See AWS ECS documentation for detailed task definitions
- Use AWS Secrets Manager for sensitive values
- Configure CloudWatch Logs

6. **Create ECS Services**
- Service auto-scaling based on CPU/memory
- Application Load Balancer for gateway
- Target tracking scaling policies

7. **Configure Application Load Balancer**
- HTTPS listener on port 443
- SSL certificate from ACM
- Target group for gateway :4000
- WebSocket support enabled

## Database Management

### Running Migrations

```bash
# Docker Compose
docker compose -f docker-compose.prod.yml exec gateway npx prisma migrate deploy

# Kubernetes
kubectl exec -it <gateway-pod> -n eve-production -- npx prisma migrate deploy

# Direct connection
cd backend
npx prisma migrate deploy
```

### Creating a Backup

```bash
# PostgreSQL backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U eve eve > backup-$(date +%Y%m%d).sql

# Or with connection string
pg_dump "postgresql://user:pass@host:5432/eve" > backup.sql

# Compress backup
gzip backup-$(date +%Y%m%d).sql
```

### Restoring from Backup

```bash
# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U eve eve < backup.sql

# Or with connection string
psql "postgresql://user:pass@host:5432/eve" < backup.sql
```

### Automated Backups

```bash
# Cron job for daily backups
0 2 * * * cd /opt/eve && ./scripts/backup-database.sh

# backup-database.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/eve"
mkdir -p $BACKUP_DIR

docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U eve eve | gzip > $BACKUP_DIR/eve-$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "eve-*.sql.gz" -mtime +30 -delete

# Upload to S3
aws s3 cp $BACKUP_DIR/eve-$DATE.sql.gz s3://my-backups/eve/
```

## Secrets Management

### Using AWS Secrets Manager

```bash
# Store secret
aws secretsmanager create-secret \
  --name eve/prod/jwt-secret \
  --secret-string "your-secret-value"

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id eve/prod/jwt-secret \
  --query SecretString \
  --output text
```

### Using HashiCorp Vault

```bash
# Write secret
vault kv put secret/eve/prod jwt_secret="..."

# Read secret
vault kv get -field=jwt_secret secret/eve/prod
```

### Using Kubernetes Secrets

```bash
# Create from literal
kubectl create secret generic eve-secrets \
  --from-literal=jwt-secret="..."

# Create from file
kubectl create secret generic eve-secrets \
  --from-file=.env.prod
```

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.example.com -d admin.example.com

# Auto-renewal (cron job created automatically)
sudo certbot renew --dry-run
```

### Custom Certificate

```nginx
ssl_certificate /etc/ssl/certs/your-cert.pem;
ssl_certificate_key /etc/ssl/private/your-key.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
```

## Monitoring and Logging

### Application Logs

```bash
# Docker Compose
docker compose -f docker-compose.prod.yml logs -f gateway

# Kubernetes
kubectl logs -f deployment/gateway -n eve-production

# Tail specific service
kubectl logs -f -l app=gateway -n eve-production
```

### CloudWatch (AWS)

```javascript
// Configure CloudWatch in ECS task definition
{
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/ecs/eve-gateway",
      "awslogs-region": "us-east-1",
      "awslogs-stream-prefix": "ecs"
    }
  }
}
```

### Prometheus + Grafana

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'eve-gateway'
    static_configs:
      - targets: ['gateway:4000']
  - job_name: 'eve-services'
    static_configs:
      - targets: ['auth:4001', 'location:4002', 'ride:4003', 'notify:4004']
```

## Backup and Recovery

### Disaster Recovery Plan

1. **Daily automated backups** of PostgreSQL
2. **Backup retention**: 30 days
3. **Off-site storage**: S3 with versioning
4. **Recovery Time Objective (RTO)**: < 4 hours
5. **Recovery Point Objective (RPO)**: < 24 hours

### Recovery Procedure

```bash
# 1. Stop services
docker compose -f docker-compose.prod.yml down

# 2. Restore database
psql "postgresql://..." < latest-backup.sql

# 3. Rebuild geo indexes
docker compose -f docker-compose.prod.yml up -d
# Indexes rebuild automatically on startup

# 4. Verify
curl http://localhost:4000/api/health
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        run: aws ecr get-login-password | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
      
      - name: Build and push images
        run: |
          docker build --target gateway -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/eve-gateway:latest .
          docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/eve-gateway:latest
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster eve-prod --service gateway --force-new-deployment
```

## Health Checks

### Endpoint Configuration

All services expose `/health` endpoints:

```bash
# Gateway
curl http://localhost:4000/api/health

# Individual services
curl http://localhost:4001/health  # Auth
curl http://localhost:4002/health  # Location
curl http://localhost:4003/health  # Ride
curl http://localhost:4004/health  # Notify
```

### Load Balancer Health Checks

```nginx
# Nginx upstream health check
upstream gateway {
    server gateway1:4000 max_fails=3 fail_timeout=30s;
    server gateway2:4000 max_fails=3 fail_timeout=30s;
    server gateway3:4000 max_fails=3 fail_timeout=30s;
}
```

### Kubernetes Liveness and Readiness

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 4000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

## Scaling

### Horizontal Scaling

**Docker Compose**:
```bash
docker compose -f docker-compose.prod.yml up -d --scale location=3 --scale ride=3
```

**Kubernetes Horizontal Pod Autoscaler**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway-hpa
  namespace: eve-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Database Scaling

- **Vertical**: Increase instance size
- **Read Replicas**: For read-heavy workloads
- **Connection Pooling**: PgBouncer

### Redis Scaling

- **Redis Cluster**: Automatic sharding
- **Read Replicas**: For read-heavy operations

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs gateway

# Check environment variables
docker compose -f docker-compose.prod.yml exec gateway env

# Check database connection
docker compose -f docker-compose.prod.yml exec gateway npx prisma db pull
```

### High Memory Usage

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
```

### Database Connection Pool Exhausted

```bash
# Increase connection pool size in Prisma
# Edit backend/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  # Add connection_limit parameter to DATABASE_URL
}

# Or use PgBouncer
```

### WebSocket Connections Dropping

```nginx
# Increase timeout in Nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

## Checklist

### Pre-Deployment

- [ ] All secrets generated and stored securely
- [ ] Auth0 production tenant configured
- [ ] Domain DNS records configured
- [ ] SSL certificates obtained
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] Load testing completed
- [ ] Security audit completed

### Post-Deployment

- [ ] All health checks passing
- [ ] SSL certificate valid
- [ ] Logs flowing correctly
- [ ] Backups running automatically
- [ ] Monitoring dashboards showing data
- [ ] Mobile apps can connect
- [ ] Admin console accessible
- [ ] Test transaction completed end-to-end

## Related Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [Environment Variables](ENVIRONMENT_VARIABLES.md)
- [Security Policy](SECURITY.md)
- [Backend Docker Guide](backend/docs/docker.md)

---

**Last Updated**: 2026-09-01
