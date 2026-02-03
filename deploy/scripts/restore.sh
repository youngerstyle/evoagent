#!/bin/bash
# EvoAgent Data Restore Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EvoAgent Data Restore Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Warning
echo -e "${YELLOW}WARNING: This will overwrite existing data!${NC}"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Stop services
echo -e "${GREEN}Stopping EvoAgent services...${NC}"
$DOCKER_COMPOSE down

# Extract backup
TEMP_DIR=$(mktemp -d)
echo -e "${GREEN}Extracting backup...${NC}"
tar xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Find backup directory
BACKUP_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "evoagent_backup_*" | head -n 1)

if [ -z "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Invalid backup file${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Restore volumes
echo -e "${GREEN}Restoring data volumes...${NC}"

# Restore evoagent-data
if [ -f "$BACKUP_DIR/evoagent-data.tar.gz" ]; then
    docker run --rm \
        -v evoagent-data:/data \
        -v "$BACKUP_DIR:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/evoagent-data.tar.gz -C /data"
    echo "✓ Restored evoagent-data"
fi

# Restore evoagent-skills
if [ -f "$BACKUP_DIR/evoagent-skills.tar.gz" ]; then
    docker run --rm \
        -v evoagent-skills:/data \
        -v "$BACKUP_DIR:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/evoagent-skills.tar.gz -C /data"
    echo "✓ Restored evoagent-skills"
fi

# Restore evoagent-sessions
if [ -f "$BACKUP_DIR/evoagent-sessions.tar.gz" ]; then
    docker run --rm \
        -v evoagent-sessions:/data \
        -v "$BACKUP_DIR:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/evoagent-sessions.tar.gz -C /data"
    echo "✓ Restored evoagent-sessions"
fi

# Restore redis-data
if [ -f "$BACKUP_DIR/redis-data.tar.gz" ]; then
    docker run --rm \
        -v redis-data:/data \
        -v "$BACKUP_DIR:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/redis-data.tar.gz -C /data"
    echo "✓ Restored redis-data"
fi

# Restore configuration files
echo -e "${GREEN}Restoring configuration files...${NC}"
if [ -f "$BACKUP_DIR/config.yaml" ]; then
    cp "$BACKUP_DIR/config.yaml" ./config.yaml
    echo "✓ Restored config.yaml"
fi

if [ -f "$BACKUP_DIR/.env" ]; then
    echo -e "${YELLOW}Found .env in backup. Restore it? (y/N)${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp "$BACKUP_DIR/.env" ./.env
        echo "✓ Restored .env"
    fi
fi

# Cleanup
rm -rf "$TEMP_DIR"

# Start services
echo -e "${GREEN}Starting EvoAgent services...${NC}"
$DOCKER_COMPOSE up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Restore completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "EvoAgent is starting up..."
echo "Check status with: $DOCKER_COMPOSE ps"
echo ""