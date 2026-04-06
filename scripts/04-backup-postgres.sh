#!/usr/bin/env bash
set -Eeuo pipefail

source /opt/wifi-portal/.env
mkdir -p /opt/wifi-portal/backups

outfile="/opt/wifi-portal/backups/postgres_$(date +%F_%H%M%S).sql.gz"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" wifi-postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip >"$outfile"

echo "Backup salvo em: $outfile"

