#!/usr/bin/env bash
set -e

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  SOURCE_DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$SOURCE_DIR/$SOURCE"
done
REPO_DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"

# Load local .env overrides (gitignored) if present
if [ -f "$REPO_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_DIR/.env"
  set +a
fi

COMPOSE_FILE="${COMPOSE_FILE:-$REPO_DIR/docker-compose.yml}"
SERVICE_NAME="${SERVICE_NAME:-thread-graph}"
LIVE_DATA_DIR="${LIVE_DATA_DIR:-$REPO_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/data/backups}"
LIVE_DATA_FILE="$LIVE_DATA_DIR/wardrobe-store.json"

cd "$REPO_DIR"

if [ "$1" = "--pull" ] || [ "$1" = "-p" ]; then
  echo "Pulling latest changes from git..."
  git pull
fi

# Ensure data directory exists
mkdir -p "$LIVE_DATA_DIR"

# Automatic safety backup of existing live data before rebuilding
if [ -f "$LIVE_DATA_FILE" ] && [ -s "$LIVE_DATA_FILE" ]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_TARGET="$BACKUP_DIR/wardrobe-store-$(date +%Y%m%d_%H%M%S).json"
  cp "$LIVE_DATA_FILE" "$BACKUP_TARGET"
  echo "Live store backed up to: $BACKUP_TARGET"
  # Keep the 15 most recent backups
  ls -tp "$BACKUP_DIR"/wardrobe-store-*.json 2>/dev/null | tail -n +16 | xargs -I {} rm -- {} 2>/dev/null || true
fi

echo "Building and starting $SERVICE_NAME..."
docker compose -f "$COMPOSE_FILE" up -d --build "$SERVICE_NAME"

echo "Status:"
docker compose -f "$COMPOSE_FILE" ps "$SERVICE_NAME"



