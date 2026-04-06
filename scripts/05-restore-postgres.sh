#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 /opt/wifi-portal/backups/arquivo.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Arquivo nao encontrado: $BACKUP_FILE"
  exit 1
fi

source /opt/wifi-portal/.env
gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" wifi-postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restore concluido a partir de: $BACKUP_FILE"

