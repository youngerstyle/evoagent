#!/bin/bash
# EvoAgent Data Backup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EvoAgent Data Backup Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="evoagent_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}Creating backup: ${BACKUP_NAME}${NC}"
echo ""

# Check if containers are running
if ! $DOCKER_COMPOSE ps | grep -q "evoagent"; then
    echo -e "${YELLOW}Warning: EvoAgent containers are not running${NC}"
    echo "Backup will only include volume data"
fi

# Create backup directory structure
mkdir -p "$BACKUP_PATH"

# Backup volumes
echo -e "${GREEN}Backing up data volumes...${NC}"

# Backup evoagent-data
docker run --rm \
    -v evoagent-data:/data \
    -v "$(pwd)/${BACKUP_PATH}:/backup" \
    alpine tar czf /backup/evoagent-data.tar.gz -C /data .

# Backup evoagent-skills
docker run --rm \
    -v evoagent-skills:/data \
    -v "$(pwd)/${BACKUP_PATH}:/backup" \
    alpine tar czf /backup/evoagent-skills.tar.gz -C /data .

# Backup evoagent-sessions
docker run --rm \
    -v evoagent-sessions:/data \
    -v "$(pwd)/${BACKUP_PATH}:/backup" \
    alpine tar czf /backup/evoagent-sessions.tar.gz -C /data .

# Backup redis-data
docker run --rm \
    -v redis-data:/data \
    -v "$(pwd)/${BACKUP_PATH}:/backup" \
    alpine tar czf /backup/redis-data.tar.gz -C /data .

# Backup configuration files
echo -e "${GREEN}Backing up configuration files...${NC}"
cp -r config.yaml "$BACKUP_PATH/" 2>/dev/null || echo "config.yaml not found"
cp -r .env "$BACKUP_PATH/" 2>/dev/null || echo ".env not found"

# Create backup metadata
cat > "$BACKUP_PATH/metadata.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "docker_compose_version": "$($DOCKER_COMPOSE version --short)",
  "volumes": [
    "evoagent-data",
    "evoagent-skills",
    "evoagent-sessions",
    "redis-data"
  ]
}
EOF

# Create compressed archive
echo -e "${GREEN}Creating compressed archive...${NC}"
cd "$BACKUP_DIR"
tar czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"
cd - > /dev/null

# Calculate size
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Backup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Backup file: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Backup size: ${BACKUP_SIZE}"
echo ""
echo "To restore this backup, run:"
echo "./deploy/scripts/restore.sh ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo ""