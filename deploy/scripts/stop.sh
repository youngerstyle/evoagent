#!/bin/bash
# EvoAgent Deployment Stop Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EvoAgent Deployment Stop Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Parse command line arguments
REMOVE_VOLUMES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --remove-volumes)
            REMOVE_VOLUMES="-v"
            echo -e "${YELLOW}Warning: This will remove all data volumes${NC}"
            read -p "Are you sure? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Cancelled"
                exit 0
            fi
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--remove-volumes]"
            exit 1
            ;;
    esac
done

# Stop services
echo -e "${GREEN}Stopping EvoAgent services...${NC}"
$DOCKER_COMPOSE down $REMOVE_VOLUMES

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EvoAgent has been stopped${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ -n "$REMOVE_VOLUMES" ]; then
    echo -e "${YELLOW}All data volumes have been removed${NC}"
else
    echo "Data volumes preserved. Use --remove-volumes to remove them."
fi
echo ""