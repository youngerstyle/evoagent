# EvoAgent Deployment Documentation

Complete guide for deploying EvoAgent in various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Cloud Platforms](#cloud-platforms)
6. [Configuration](#configuration)
7. [Monitoring](#monitoring)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Disk: 20GB
- OS: Linux (Ubuntu 20.04+), macOS, Windows with WSL2

**Recommended:**
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 50GB+ SSD
- OS: Linux (Ubuntu 22.04+)

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (for local development)
- Git

### API Keys

Required API keys:
- **Anthropic API Key** (required for Claude models)
- **OpenAI API Key** (optional, for GPT models)

Get your keys:
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/

## Deployment Options

### 1. Docker Compose (Recommended)

Best for:
- Single server deployments
- Development and testing
- Small to medium scale

Pros:
- Simple setup
- Easy to manage
- Good for getting started

Cons:
- Single host limitation
- Manual scaling

### 2. Kubernetes

Best for:
- Production environments
- Multi-server deployments
- Auto-scaling requirements
- High availability

Pros:
- Automatic scaling
- Self-healing
- Load balancing
- Rolling updates

Cons:
- Complex setup
- Requires K8s knowledge
- Higher resource overhead

### 3. Cloud Platforms

Best for:
- Managed infrastructure
- Global distribution
- Enterprise deployments

Supported platforms:
- AWS (ECS, EKS)
- Google Cloud (GKE)
- Azure (AKS)
- DigitalOcean
- Heroku

## Docker Deployment

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/evoagent.git
   cd evoagent
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your API keys
   ```

3. **Start services:**
   ```bash
   chmod +x deploy/scripts/*.sh
   ./deploy/scripts/start.sh
   ```

4. **Verify deployment:**
   ```bash
   curl http://localhost:18790/health
   ```

### Configuration Options

#### Basic Deployment

Minimal setup with just EvoAgent and Redis:

```bash
./deploy/scripts/start.sh
```

#### With Monitoring

Include Prometheus and Grafana:

```bash
./deploy/scripts/start.sh --with-metrics
```

#### With Reverse Proxy

Include Nginx for SSL termination and load balancing:

```bash
./deploy/scripts/start.sh --with-proxy
```

#### Full Stack

All components:

```bash
./deploy/scripts/start.sh --with-metrics --with-proxy
```

### Custom Configuration

Edit `docker-compose.yml` for custom settings:

```yaml
services:
  evoagent:
    environment:
      - MAX_CONCURRENT_SESSIONS=20
      - SESSION_TIMEOUT_MS=7200000
      - LOG_LEVEL=debug
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
```

### Data Persistence

Data is stored in Docker volumes:

```bash
# List volumes
docker volume ls | grep evoagent

# Inspect volume
docker volume inspect evoagent-data

# Backup volume
docker run --rm -v evoagent-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/evoagent-data.tar.gz -C /data .
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Helm 3+ (optional)

### Using kubectl

1. **Create namespace:**
   ```bash
   kubectl create namespace evoagent
   ```

2. **Create secrets:**
   ```bash
   kubectl create secret generic evoagent-secrets \
     --from-literal=anthropic-api-key=YOUR_KEY \
     --from-literal=openai-api-key=YOUR_KEY \
     -n evoagent
   ```

3. **Deploy:**
   ```bash
   kubectl apply -f deploy/k8s/ -n evoagent
   ```

4. **Check status:**
   ```bash
   kubectl get pods -n evoagent
   kubectl get svc -n evoagent
   ```

### Using Helm

```bash
# Add repository
helm repo add evoagent https://charts.evoagent.dev

# Install
helm install evoagent evoagent/evoagent \
  --namespace evoagent \
  --create-namespace \
  --set apiKeys.anthropic=YOUR_KEY \
  --set apiKeys.openai=YOUR_KEY
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment evoagent --replicas=3 -n evoagent

# Auto-scaling
kubectl autoscale deployment evoagent \
  --min=2 --max=10 \
  --cpu-percent=70 \
  -n evoagent
```

## Cloud Platforms

### AWS Deployment

#### Using ECS

1. **Create ECR repository:**
   ```bash
   aws ecr create-repository --repository-name evoagent
   ```

2. **Build and push image:**
   ```bash
   docker build -t evoagent .
   docker tag evoagent:latest YOUR_ECR_URL/evoagent:latest
   docker push YOUR_ECR_URL/evoagent:latest
   ```

3. **Create ECS task definition and service**

#### Using EKS

```bash
# Create cluster
eksctl create cluster --name evoagent-cluster --region us-west-2

# Deploy
kubectl apply -f deploy/k8s/
```

### Google Cloud Platform

#### Using Cloud Run

```bash
# Build and deploy
gcloud run deploy evoagent \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Using GKE

```bash
# Create cluster
gcloud container clusters create evoagent-cluster \
  --num-nodes=3 \
  --machine-type=n1-standard-2

# Deploy
kubectl apply -f deploy/k8s/
```

### Azure

#### Using AKS

```bash
# Create cluster
az aks create \
  --resource-group evoagent-rg \
  --name evoagent-cluster \
  --node-count 3

# Get credentials
az aks get-credentials \
  --resource-group evoagent-rg \
  --name evoagent-cluster

# Deploy
kubectl apply -f deploy/k8s/
```

### DigitalOcean

```bash
# Create Kubernetes cluster via UI or CLI
doctl kubernetes cluster create evoagent-cluster

# Deploy
kubectl apply -f deploy/k8s/
```

## Configuration

### Environment Variables

Complete list of environment variables:

```bash
# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022

# Server Configuration
EVOAGENT_PORT=18790
NODE_ENV=production
HOST=0.0.0.0

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_OUTPUT=stdout

# Session Management
MAX_CONCURRENT_SESSIONS=10
SESSION_TIMEOUT_MS=3600000
SESSION_STORAGE_PATH=/app/data/sessions

# Skills
SKILLS_PATH=/app/data/skills
SKILLS_AUTO_LEARN=true

# Memory
MEMORY_STORAGE_PATH=/app/data/memory
MEMORY_MAX_SIZE_MB=1000

# Observability
ENABLE_METRICS=true
METRICS_PORT=9090
PROMETHEUS_ENABLED=false

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Security
ENABLE_AUTH=false
JWT_SECRET=
CORS_ORIGIN=*

# Performance
MAX_WORKERS=4
REQUEST_TIMEOUT_MS=30000
```

### Configuration File

Use `config.yaml` for structured configuration:

```yaml
version: "1.0.0"

server:
  host: "0.0.0.0"
  port: 18790

llm:
  provider: "anthropic"
  model: "claude-3-5-sonnet-20241022"
  apiKey: "${ANTHROPIC_API_KEY}"

sessions:
  maxConcurrent: 10
  timeoutMs: 3600000
  storagePath: "/app/data/sessions"

skills:
  path: "/app/data/skills"
  autoLearn: true

observability:
  enableMetrics: true
  logLevel: "info"
```

## Monitoring

### Health Checks

```bash
# Basic health check
curl http://localhost:18790/health

# Detailed status
curl http://localhost:18790/api/status
```

### Metrics

Access Prometheus metrics:

```bash
curl http://localhost:18790/metrics
```

Key metrics:
- `evoagent_sessions_active`: Active sessions
- `evoagent_requests_total`: Total requests
- `evoagent_request_duration_seconds`: Request latency
- `evoagent_errors_total`: Error count
- `evoagent_skills_total`: Total skills learned

### Grafana Dashboards

Access Grafana at `http://localhost:3000`:

1. Login (default: admin/admin)
2. Navigate to Dashboards
3. Import EvoAgent dashboard

### Logging

View logs:

```bash
# Docker Compose
docker compose logs -f evoagent

# Kubernetes
kubectl logs -f deployment/evoagent -n evoagent

# Follow specific pod
kubectl logs -f pod/evoagent-xxx -n evoagent
```

### Alerting

Configure alerts in `deploy/prometheus/alerts.yml`:

```yaml
groups:
  - name: evoagent
    rules:
      - alert: HighErrorRate
        expr: rate(evoagent_errors_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High error rate detected"
```

## Security

### Best Practices

1. **Use secrets management:**
   - Docker Secrets
   - Kubernetes Secrets
   - AWS Secrets Manager
   - HashiCorp Vault

2. **Enable authentication:**
   ```yaml
   security:
     enableAuth: true
     jwtSecret: "${JWT_SECRET}"
   ```

3. **Use HTTPS:**
   - Configure SSL certificates
   - Enable TLS in Nginx
   - Use cert-manager in K8s

4. **Network security:**
   - Use private networks
   - Configure firewalls
   - Implement rate limiting

5. **Regular updates:**
   ```bash
   # Update images
   docker compose pull
   docker compose up -d
   ```

### SSL/TLS Configuration

#### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure Nginx
# Edit deploy/nginx/nginx.conf with certificate paths
```

#### Custom Certificates

```bash
# Place certificates
cp your-cert.pem deploy/nginx/ssl/cert.pem
cp your-key.pem deploy/nginx/ssl/key.pem

# Update nginx.conf
# Restart Nginx
docker compose restart nginx
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

**Symptoms:** Container exits immediately

**Solutions:**
```bash
# Check logs
docker compose logs evoagent

# Verify configuration
docker compose config

# Check environment variables
docker compose exec evoagent env
```

#### 2. API Key Errors

**Symptoms:** "Invalid API key" errors

**Solutions:**
- Verify API key in `.env`
- Check key format (no extra spaces)
- Ensure key has proper permissions
- Test key directly with API

#### 3. Connection Refused

**Symptoms:** Cannot connect to WebSocket

**Solutions:**
```bash
# Check if service is running
docker compose ps

# Verify port binding
netstat -tuln | grep 18790

# Test connectivity
curl -v http://localhost:18790/health
```

#### 4. Out of Memory

**Symptoms:** Container crashes, OOM errors

**Solutions:**
```yaml
# Increase memory limit
services:
  evoagent:
    deploy:
      resources:
        limits:
          memory: 8G
```

#### 5. Slow Performance

**Symptoms:** High latency, timeouts

**Solutions:**
- Check resource usage: `docker stats`
- Review logs for errors
- Increase worker count
- Scale horizontally
- Optimize session timeout

### Debug Mode

Enable debug logging:

```bash
# Docker Compose
docker compose up -d --env LOG_LEVEL=debug

# Kubernetes
kubectl set env deployment/evoagent LOG_LEVEL=debug -n evoagent
```

### Support

For additional help:

- Documentation: https://docs.evoagent.dev
- GitHub Issues: https://github.com/your-org/evoagent/issues
- Community Discord: https://discord.gg/evoagent
- Email: support@evoagent.dev

## Appendix

### Useful Commands

```bash
# Docker Compose
docker compose up -d              # Start services
docker compose down               # Stop services
docker compose ps                 # List services
docker compose logs -f            # Follow logs
docker compose exec evoagent sh  # Shell access

# Kubernetes
kubectl get pods -n evoagent      # List pods
kubectl describe pod POD -n evoagent  # Pod details
kubectl logs -f POD -n evoagent   # Follow logs
kubectl exec -it POD -n evoagent -- sh  # Shell access
kubectl port-forward POD 18790:18790  # Port forward

# Docker
docker ps                         # List containers
docker logs -f CONTAINER          # Follow logs
docker exec -it CONTAINER sh      # Shell access
docker stats                      # Resource usage
```

### Performance Tuning

```yaml
# docker-compose.yml
services:
  evoagent:
    environment:
      - NODE_OPTIONS=--max-old-space-size=4096
      - UV_THREADPOOL_SIZE=16
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

### Backup Strategy

```bash
# Daily backups
0 2 * * * /path/to/evoagent/deploy/scripts/backup.sh

# Weekly full backups
0 3 * * 0 /path/to/evoagent/deploy/scripts/backup.sh

# Retention: Keep last 7 daily, 4 weekly
find /backups -name "evoagent_backup_*.tar.gz" -mtime +7 -delete
```