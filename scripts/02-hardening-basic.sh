#!/usr/bin/env bash
set -Eeuo pipefail

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1812/udp
ufw allow 1813/udp
ufw allow 53/udp
ufw --force enable

systemctl enable fail2ban
systemctl restart fail2ban

mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/99-persistent.conf <<EOFJ
[Journal]
Storage=persistent
SystemMaxUse=1G
EOFJ

systemctl restart systemd-journald

echo "Hardening basico aplicado."

