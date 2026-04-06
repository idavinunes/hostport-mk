#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${TARGET_DIR:-/opt/wifi-portal}"
TARGET_OWNER="${TARGET_OWNER:-${SUDO_USER:-}}"

if [[ ! -f "$REPO_ROOT/.env" ]]; then
  echo "Copie .env.example para .env e ajuste as variaveis antes do deploy."
  exit 1
fi

install -d -m 0755 "$TARGET_DIR"

rsync -a \
  --exclude ".env" \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".next" \
  "$REPO_ROOT"/ "$TARGET_DIR"/

cp "$REPO_ROOT/.env" "$TARGET_DIR/.env"

if [[ -n "$TARGET_OWNER" ]] && id "$TARGET_OWNER" >/dev/null 2>&1; then
  chown -R "$TARGET_OWNER:$TARGET_OWNER" "$TARGET_DIR"
fi

cd "$TARGET_DIR"
docker compose pull || true
docker compose build
docker compose up -d
docker compose ps
