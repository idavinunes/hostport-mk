#!/usr/bin/env bash
set -Eeuo pipefail

journalctl --vacuum-time=14d
find /opt/wifi-portal/backups -type f -mtime +30 -delete

echo "Rotacao basica executada."
