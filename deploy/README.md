# EvoAgent Deployment Guide

This directory contains deployment configurations and scripts for running EvoAgent in production.

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- Valid API keys (Anthropic/OpenAI)

### Basic Deployment

1. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

2. **Start EvoAgent:**
   ```bash
   ./deploy/scripts/start.sh
   ```

3. **Access the service:**
   - WebSocket Gateway: `ws://localhost:18790/ws`
   - Health Check: `http://localhost:18790/health`

### With Monitoring Stack

To deploy with Prometheus and Grafana:

```bash
./deploy/scripts/start.sh --with-metrics
```

Access:
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (default: admin/admin)

### With Nginx Reverse Proxy

To deploy with Nginx as a reverse proxy:

```bash
./deploy/scripts/start.sh --with-proxy
```

Access through: `http://localhost:80`

### Full Stack

Deploy everything:

```bash
./deploy/scripts/start.sh --with-metrics --with-proxy
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Optional)                      │
│                  Reverse Proxy + SSL                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   EvoAgent Main                          │
│              WebSocket Gateway + API                     │
│         Agent Orchestration + Skill System               │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────────┐
│    Redis     │ │Prometheus│ │   Grafana   │
│   (Cache)    │ │(Metrics) │ │(Dashboard)  │
└──────────────┘ └──────────┘ └─────────────┘
```

## Directory Structure

```
deploy/
├── README.md                    # This file
├── scripts/
│   ├── start.sh                # Start deployment
│   ├── stop.sh                 # Stop deployment
│   ├── backup.sh               # Backup data
│   └── restore.sh              # Restore from backup
├── prometheus/
│   └── prometheus.yml          # Prometheus configuration
├── grafana/
│   ├── datasources/            # Grafana datasources
│   └── dashboards/             # Grafana dashboards
└── nginx/
    └── nginx.conf              # Nginx configuration
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Server
EVOAGENT_PORT=18790
NODE_ENV=production
LOG_LEVEL=info

# Sessions
MAX_CONCURRENT_SESSIONS=10
SESSION_TIMEOUT_MS=3600000

# Monitoring
ENABLE_METRICS=true
PROMETHEUS_ENABLED=false
```

### Docker Compose Profiles

- **default**: EvoAgent + Redis
- **metrics**: + Prometheus + Grafana
- **proxy**: + Nginx reverse proxy

## Data Persistence

EvoAgent uses Docker volumes for data persistence:

- `evoagent-data`: General application data
- `evoagent-skills`: Learned skills
- `evoagent-sessions`: Session history
- `evoagent-logs`: Application logs
- `redis-data`: Redis cache data

## Backup and Restore

### Create Backup

```bash
./deploy/scripts/backup.sh
```

Backups are stored in `./backups/` by default.

### Restore from Backup

```bash
./deploy/scripts/restore.sh ./backups/evoagent_backup_YYYYMMDD_HHMMSS.tar.gz
```

**Warning:** This will overwrite existing data!

## Monitoring

### Health Checks

Check service health:

```bash
curl http://localhost:18790/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": 1234567890,
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Logs

View logs:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f evoagent

# Last 100 lines
docker compose logs --tail=100 evoagent
```

### Metrics

If Prometheus is enabled, metrics are available at:
- EvoAgent metrics: `http://localhost:18790/metrics`
- Prometheus UI: `http://localhost:9090`
- Grafana dashboards: `http://localhost:3000`

## Scaling

### Horizontal Scaling

To run multiple EvoAgent instances:

```bash
docker compose up -d --scale evoagent=3
```

**Note:** You'll need to configure a load balancer (Nginx) to distribute traffic.

### Resource Limits

Edit `docker-compose.yml` to add resource limits:

```yaml
services:
  evoagent:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Security

### Production Checklist

- [ ] Change default Grafana password
- [ ] Use strong API keys
- [ ] Enable HTTPS/TLS (configure Nginx SSL)
- [ ] Restrict metrics endpoint access
- [ ] Use Docker secrets for sensitive data
- [ ] Enable firewall rules
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity

### SSL/TLS Configuration

1. Obtain SSL certificates (Let's Encrypt recommended)
2. Place certificates in `deploy/nginx/ssl/`
3. Uncomment HTTPS server block in `nginx.conf`
4. Restart Nginx:
   ```bash
   docker compose restart nginx
   ```

### Secrets Management

For production, use Docker secrets instead of environment variables:

```yaml
services:
  evoagent:
    secrets:
      - anthropic_api_key
      - openai_api_key

secrets:
  anthropic_api_key:
    file: ./secrets/anthropic_api_key.txt
  openai_api_key:
    file: ./secrets/openai_api_key.txt
```

## Troubleshooting

### Container Won't Start

1. Check logs:
   ```bash
   docker compose logs evoagent
   ```

2. Verify configuration:
   ```bash
   docker compose config
   ```

3. Check resource availability:
   ```bash
   docker stats
   ```

### Connection Issues

1. Verify port availability:
   ```bash
   netstat -tuln | grep 18790
   ```

2. Check firewall rules:
   ```bash
   sudo ufw status
   ```

3. Test connectivity:
   ```bash
   curl -v http://localhost:18790/health
   ```

### Performance Issues

1. Check resource usage:
   ```bash
   docker stats
   ```

2. Review logs for errors:
   ```bash
   docker compose logs --tail=100 evoagent | grep ERROR
   ```

3. Monitor metrics in Grafana

### Data Loss

If data is lost:

1. Check volume status:
   ```bash
   docker volume ls
   docker volume inspect evoagent-data
   ```

2. Restore from backup:
   ```bash
   ./deploy/scripts/restore.sh <backup-file>
   ```

## Maintenance

### Updates

1. Pull latest changes:
   ```bash
   git pull origin main
   ```

2. Rebuild and restart:
   ```bash
   ./deploy/scripts/start.sh --build
   ```

### Cleanup

Remove old images and volumes:

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (careful!)
docker volume prune

# Complete cleanup (removes all data!)
docker compose down -v
```

### Log Rotation

Configure log rotation in `docker-compose.yml`:

```yaml
services:
  evoagent:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Advanced Configuration

### Custom Network

Create a custom network for better isolation:

```bash
docker network create evoagent-net
```

Update `docker-compose.yml` to use the custom network.

### External Database

To use an external Redis instance:

1. Remove Redis service from `docker-compose.yml`
2. Update EvoAgent configuration to point to external Redis
3. Ensure network connectivity

### Multi-Host Deployment

For deploying across multiple hosts, consider:

- Docker Swarm
- Kubernetes (see `deploy/k8s/` for manifests)
- Nomad

## Support

For issues and questions:

- GitHub Issues: https://github.com/your-org/evoagent/issues
- Documentation: https://docs.evoagent.dev
- Community: https://discord.gg/evoagent

## License

See LICENSE file in the root directory.