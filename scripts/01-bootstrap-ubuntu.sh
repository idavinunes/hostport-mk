#!/usr/bin/env bash
set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
apt-get install -y \
  acl \
  ca-certificates \
  curl \
  dnsutils \
  fail2ban \
  git \
  gnupg \
  htop \
  jq \
  lsb-release \
  net-tools \
  openssl \
  rsync \
  software-properties-common \
  ufw \
  unzip \
  vim

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat >/etc/apt/sources.list.d/docker.sources <<DOCKERREPO
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
DOCKERREPO

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker

if ! getent group docker >/dev/null; then
  groupadd docker
fi

TARGET_USER="${SUDO_USER:-$USER}"
usermod -aG docker "$TARGET_USER"

install -d -m 0755 /opt/wifi-portal
install -d -m 0755 /opt/wifi-portal/backups
install -d -m 0755 /opt/wifi-portal/logs
chown -R "$TARGET_USER:$TARGET_USER" /opt/wifi-portal

echo "Bootstrap concluido. Faca logout/login para usar docker sem sudo."

