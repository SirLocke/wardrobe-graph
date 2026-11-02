#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="/opt/docker/docker-compose.yml"
LIVE_DATA_DIR="/opt/docker/wardrobe/data"
LIVE_DATA_FILE="$LIVE_DATA_DIR/wardrobe-store.json"
BACKUP_DIR="/opt/docker/wardrobe/backups"

cd "$REPO_DIR"

if [ "$1" = "--pull" ] || [ "$1" = "-p" ]; then
  echo "Pulling latest changes from git..."
  git pull
fi

# Ensure data directory exists
mkdir -p "$LIVE_DATA_DIR"

# 1. Automatic safety backup of existing live data before rebuilding
if [ -f "$LIVE_DATA_FILE" ] && [ -s "$LIVE_DATA_FILE" ]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_TARGET="$BACKUP_DIR/wardrobe-store-$(date +%Y%m%d_%H%M%S).json"
  cp "$LIVE_DATA_FILE" "$BACKUP_TARGET"
  echo "Live store backed up to: $BACKUP_TARGET"
  # Keep the 15 most recent backups
  ls -tp "$BACKUP_DIR"/wardrobe-store-*.json 2>/dev/null | tail -n +16 | xargs -I {} rm -- {} 2>/dev/null || true
elif [ ! -f "$LIVE_DATA_FILE" ] && [ -f "$REPO_DIR/data/wardrobe-store.json" ]; then
  # Initialize with seed file only if live data does not exist at all
  echo "Initializing live store from template..."
  cp "$REPO_DIR/data/wardrobe-store.json" "$LIVE_DATA_FILE"
fi

echo "Building and starting wardrobe-graph..."
docker compose -f "$COMPOSE_FILE" up -d --build wardrobe-graph

echo "Status:"
docker compose -f "$COMPOSE_FILE" ps wardrobe-graph
