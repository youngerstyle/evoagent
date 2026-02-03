#!/bin/bash
# EvoAgent Deployment Start Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EvoAgent Deployment Start Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Please edit .env file with your configuration${NC}"
        exit 1
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Determine docker compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Parse command line arguments
PROFILE=""
BUILD_FLAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --with-metrics)
            PROFILE="--profile metrics"
            echo -e "${GREEN}Enabling metrics stack (Prometheus + Grafana)${NC}"
            shift
            ;;
        --with-proxy)
            PROFILE="$PROFILE --profile proxy"
            echo -e "${GREEN}Enabling Nginx reverse proxy${NC}"
            shift
            ;;
        --build)
            BUILD_FLAG="--build"
            echo -e "${GREEN}Building images from scratch${NC}"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--with-metrics] [--with-proxy] [--build]"
            exit 1
            ;;
    esac
done

# Pull latest images (if not building)
if [ -z "$BUILD_FLAG" ]; then
    echo -e "${GREEN}Pulling latest images...${NC}"
    $DOCKER_COMPOSE pull
fi

# Start services
echo -e "${GREEN}Starting EvoAgent services...${NC}"
$DOCKER_COMPOSE up -d $BUILD_FLAG $PROFILE

# Wait for services to be healthy
echo -e "${GREEN}Waiting for services to be healthy...${NC}"
sleep 5

# Check service status
echo ""
echo -e "${GREEN}Service Status:${NC}"
$DOCKER_COMPOSE ps

# Show logs
echo ""
echo -e "${GREEN}Recent logs:${NC}"
$DOCKER_COMPOSE logs --tail=20

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EvoAgent is now running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "WebSocket Gateway: ws://localhost:18790/ws"
echo "Health Check: http://localhost:18790/health"

if [[ $PROFILE == *"metrics"* ]]; then
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3000 (admin/admin)"
fi

if [[ $PROFILE == *"proxy"* ]]; then
    echo "Nginx Proxy: http://localhost:80"
fi

echo ""
echo "To view logs: $DOCKER_COMPOSE logs -f"
echo "To stop: $DOCKER_COMPOSE down"
echo ""