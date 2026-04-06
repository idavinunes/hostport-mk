# Projeto Wi-Fi Captive Portal para Academia — Ubuntu 22.04 + MikroTik + FreeRADIUS + LGPD

## 1) Arquitetura recomendada

- **MikroTik**: HotSpot/captive portal, enforcement da autenticação, accounting RADIUS.
- **Ubuntu 22.04**: host principal.
- **Docker Engine + Docker Compose plugin**.
- **PostgreSQL**: base de dados.
- **FreeRADIUS**: AAA (auth, authz, accounting).
- **Backend API**: FastAPI.
- **Frontend Admin**: Next.js.
- **Reverse proxy**: Caddy.
- **Redis**: opcional para fila/cache/sessões.

## 2) Estrutura sugerida do repositório

```text
wifi-portal/
├── .env.example
├── docker-compose.yml
├── Makefile
├── README.md
├── scripts/
│   ├── 01-bootstrap-ubuntu.sh
│   ├── 02-hardening-basic.sh
│   ├── 03-deploy-stack.sh
│   ├── 04-backup-postgres.sh
│   ├── 05-restore-postgres.sh
│   └── 06-rotate-logs.sh
├── docs/
│   ├── architecture.md
│   ├── adr-001-servidor-externo-vs-user-manager.md
│   ├── lgpd.md
│   ├── retention-policy.md
│   ├── incident-runbook.md
│   └── mikrotik-integration.md
├── infra/
│   ├── caddy/
│   │   └── Caddyfile
│   ├── postgres/
│   │   ├── init/
│   │   │   ├── 001-schema.sql
│   │   │   ├── 002-seeds.sql
│   │   │   └── 003-radius-views.sql
│   └── freeradius/
│       ├── clients.conf
│       ├── mods-config/
│       │   └── sql/
│       ├── sites-enabled/
│       │   ├── default
│       │   └── inner-tunnel
│       └── dictionary
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   └── security/
│   ├── alembic/
│   ├── Dockerfile
│   └── requirements.txt
└── frontend/
    ├── app/
    ├── components/
    ├── lib/
    ├── Dockerfile
    └── package.json
```

## 3) Bootstrap do Ubuntu 22.04

### scripts/01-bootstrap-ubuntu.sh

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  unzip \
  jq \
  vim \
  ufw \
  fail2ban \
  openssl \
  acl \
  htop \
  net-tools \
  dnsutils \
  software-properties-common

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
usermod -aG docker ${SUDO_USER:-$USER}

mkdir -p /opt/wifi-portal/{infra,logs,backups}
chown -R ${SUDO_USER:-$USER}:${SUDO_USER:-$USER} /opt/wifi-portal

echo "Bootstrap concluído. Faça logout/login para usar docker sem sudo."
```

### scripts/02-hardening-basic.sh

```bash
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

echo "Hardening básico aplicado."
```

## 4) Variáveis de ambiente

### .env.example

```env
TZ=America/Sao_Paulo
PROJECT_NAME=wifi-portal
DOMAIN=wifi.suaacademia.local
ACME_EMAIL=infra@suaacademia.com.br

POSTGRES_DB=wifi_portal
POSTGRES_USER=wifi_portal
POSTGRES_PASSWORD=troque_esta_senha
POSTGRES_PORT=5432

REDIS_PORT=6379

BACKEND_PORT=8000
FRONTEND_PORT=3000

JWT_SECRET=troque_este_jwt_secret
APP_ENCRYPTION_KEY=troque_esta_chave_de_32_bytes

RADIUS_DB_USER=radius
RADIUS_DB_PASSWORD=troque_esta_senha_radius
RADIUS_DB_NAME=radius

MIKROTIK_RADIUS_SECRET=troque_este_shared_secret
MIKROTIK_NAS_IP=10.10.10.1
MIKROTIK_NAS_NAME=mikrotik-academia
MIKROTIK_SRC_IP=10.10.10.1

OTP_PROVIDER=disabled
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
```

## 5) Docker Compose

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16
    container_name: wifi-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: wifi-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
    container_name: wifi-backend
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
    container_name: wifi-frontend
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      - backend
    ports:
      - "3000:3000"

  freeradius:
    image: freeradius/freeradius-server:latest
    container_name: wifi-freeradius
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "1812:1812/udp"
      - "1813:1813/udp"
    volumes:
      - ./infra/freeradius/clients.conf:/etc/freeradius/3.0/clients.conf:ro
      - ./infra/freeradius/mods-config:/etc/freeradius/3.0/mods-config:ro
      - ./infra/freeradius/sites-enabled:/etc/freeradius/3.0/sites-enabled:ro
      - ./infra/freeradius/dictionary:/etc/freeradius/3.0/dictionary:ro

  caddy:
    image: caddy:2
    container_name: wifi-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - frontend
    volumes:
      - ./infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

## 6) Caddyfile

### infra/caddy/Caddyfile

```caddy
{$DOMAIN} {
  encode zstd gzip

  @api path /api/* /docs* /openapi.json
  handle @api {
    reverse_proxy backend:8000
  }

  handle {
    reverse_proxy frontend:3000
  }

  tls {$ACME_EMAIL}
}
```

## 7) Banco de dados mínimo

### infra/postgres/init/001-schema.sql

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_type TEXT NOT NULL CHECK (registration_type IN ('visitor','member')),
  full_name TEXT NOT NULL,
  cpf_ciphertext BYTEA,
  cpf_hash TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','inactive')),
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT,
  privacy_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  download_kbps INTEGER NOT NULL,
  upload_kbps INTEGER NOT NULL,
  quota_mb BIGINT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE client_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  mac_ciphertext BYTEA NOT NULL,
  mac_hash TEXT NOT NULL UNIQUE,
  nickname TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE routers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nas_identifier TEXT NOT NULL UNIQUE,
  ip_address INET NOT NULL,
  site_name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radius_session_id TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  ip_local INET,
  ip_public INET,
  nas_ip_address INET,
  called_station_id TEXT,
  calling_station_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  session_time_seconds BIGINT,
  input_octets BIGINT,
  output_octets BIGINT,
  terminate_cause TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  source_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 8) FreeRADIUS — cliente MikroTik

### infra/freeradius/clients.conf

```conf
client mikrotik_academia {
  ipaddr = 10.10.10.1
  secret = troque_este_shared_secret
  shortname = mikrotik-academia
  nastype = mikrotik
}
```

### Estratégia RADIUS

- O MikroTik envia `Calling-Station-Id` com o MAC do cliente.
- O backend grava o cadastro e o plano.
- O FreeRADIUS consulta a base e responde com atributos de rate-limit e sessão.
- Accounting Update e Stop alimentam a tabela `sessions`.

### Atributos típicos de resposta para MikroTik

```text
Mikrotik-Rate-Limit := "20M/20M"
Session-Timeout := 28800
Idle-Timeout := 900
```

## 9) Script de deploy

### scripts/03-deploy-stack.sh

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/wifi-portal

if [[ ! -f .env ]]; then
  echo "Copie .env.example para .env e ajuste as variáveis antes do deploy."
  exit 1
fi

docker compose pull || true
docker compose build --no-cache
docker compose up -d

docker compose ps
```

## 10) Backup PostgreSQL

### scripts/04-backup-postgres.sh

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

source /opt/wifi-portal/.env
mkdir -p /opt/wifi-portal/backups

outfile="/opt/wifi-portal/backups/postgres_$(date +%F_%H%M%S).sql.gz"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" wifi-postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$outfile"

echo "Backup salvo em: $outfile"
```

## 11) Prompt mestre para o Codex

```text
Você é um engenheiro principal de software, DevOps, redes MikroTik, FreeRADIUS e privacidade.

Sua tarefa é criar um sistema completo de captive portal para academia, hospedado em Ubuntu 22.04, integrado com MikroTik via HotSpot + RADIUS + Accounting, obedecendo o Marco Civil da Internet e os princípios da LGPD.

CONTEXTO DE NEGÓCIO
- Ambiente: academia com Wi-Fi controlado.
- Objetivo: autenticar usuários no Wi-Fi, identificar a sessão com vínculo entre usuário e dispositivo, controlar planos/regras de acesso, manter registros de conexão, e separar claramente consentimento opcional de marketing.
- Dados tratados: nome completo, CPF, MAC address, IP, data/hora da sessão, NAS/AP/MikroTik, aceite dos termos, opt-in de marketing separado.
- Não armazenar conteúdo de navegação.
- O sistema deve ser auditável, simples de operar e pronto para produção inicial.

PREMISSAS TÉCNICAS
- SO alvo: Ubuntu 22.04 LTS.
- Infra: Docker Engine + Docker Compose plugin.
- Banco: PostgreSQL.
- AAA: FreeRADIUS.
- API: FastAPI Python.
- Frontend admin: Next.js.
- Reverse proxy/TLS: Caddy.
- Logs da aplicação em JSON; logs do host via journald.
- Sem Kubernetes.

DIRETRIZES JURÍDICAS E DE PRIVACIDADE
- Aplicar finalidade, adequação e necessidade.
- Tratar registros de conexão e não conteúdo de navegação.
- Usar CPF como identificador forte no contexto da academia, mas manter marketing separado com checkbox opcional.
- Criar Termos de Uso e Política de Privacidade.
- Criar política de retenção e runbook de incidente.
- Incluir trilha de auditoria.
- Marcar qualquer ponto duvidoso como: VALIDAR COM JURÍDICO.

REQUISITOS FUNCIONAIS
1. Cadastro de clientes com:
   - full_name
   - cpf (armazenado cifrado + hash para lookup)
   - phone
   - email
   - status
   - termos aceitos, versão e timestamp
   - privacy aceita, versão e timestamp
   - marketing_opt_in separado
2. Cadastro de dispositivos:
   - vínculo com cliente
   - MAC cifrado + hash
   - nickname
   - bloqueio
3. Cadastro de roteadores/NAS:
   - nome
   - NAS-Identifier
   - IP
   - unidade
4. Cadastro de planos:
   - nome
   - banda down/up
   - cota opcional
   - timeout opcional
5. Autenticação RADIUS:
   - login HotSpot
   - resposta com Mikrotik-Rate-Limit
   - Session-Timeout, Idle-Timeout quando aplicável
6. Accounting:
   - start, interim-update, stop
   - bytes in/out
   - calling-station-id
   - called-station-id
   - nas ip
   - session id
7. Painel admin:
   - clientes
   - dispositivos
   - roteadores
   - planos
   - sessões ativas
   - auditoria
8. Autoatendimento mínimo:
   - página mostrando dados do cliente, dispositivos autorizados e termo/privacidade
9. Segurança:
   - autenticação admin
   - RBAC
   - mascaramento de CPF/MAC na UI
   - criptografia no app para CPF/MAC
   - validação de input
   - rate limit em endpoints sensíveis
10. Operação:
   - scripts de backup e restore
   - seed inicial
   - health checks
   - documentação de troubleshooting

ENTREGÁVEIS OBRIGATÓRIOS
- Repositório completo com:
  - docker-compose.yml
  - .env.example
  - scripts/01-bootstrap-ubuntu.sh
  - scripts/02-hardening-basic.sh
  - scripts/03-deploy-stack.sh
  - scripts/04-backup-postgres.sh
  - scripts/05-restore-postgres.sh
  - infra/caddy/Caddyfile
  - infra/postgres/init/001-schema.sql
  - infra/postgres/init/002-seeds.sql
  - infra/freeradius/clients.conf
  - infra/freeradius/sites-enabled/default
  - infra/freeradius/sites-enabled/inner-tunnel
  - backend funcional
  - frontend funcional
  - docs/architecture.md
  - docs/mikrotik-integration.md
  - docs/lgpd.md
  - docs/retention-policy.md
  - docs/incident-runbook.md
  - README.md

REQUISITOS DE CÓDIGO
- Produza código real, não pseudocódigo.
- Sempre gere arquivos completos.
- Não omita imports.
- Não deixe TODOs vagos.
- Use tipagem onde aplicável.
- Backend com migrations ou SQL inicial funcional.
- Endpoints com validação.
- Frontend com páginas funcionais de listagem e edição básicas.
- Inclua instruções de execução local e produção.

INTEGRAÇÃO MIKROTIK
- Gere um guia passo a passo para RouterOS v7 com:
  1. criação de pool DHCP
  2. criação de bridge/vlan se necessário
  3. ativação do HotSpot
  4. configuração do profile com radius-accounting habilitado
  5. ajuste de radius-interim-update
  6. configuração do /radius com service=hotspot
  7. definição de src-address
  8. criação de walled-garden para domínio do portal quando necessário
  9. testes de autenticação
  10. troubleshooting com /radius monitor, logs e simulação de login
- Gere os comandos RouterOS exatos, comentados.

REGRAS DE IMPLEMENTAÇÃO
- Primeiro escreva architecture.md.
- Depois escreva a árvore de diretórios.
- Depois gere os scripts de bootstrap.
- Depois docker-compose.
- Depois banco.
- Depois freeradius.
- Depois backend.
- Depois frontend.
- Depois documentação MikroTik.
- Depois docs LGPD/termos.
- Ao final, gere uma checklist de validação ponta a ponta.

CRITÉRIO DE SUCESSO
- Um operador sobe a stack em Ubuntu 22.04.
- Conecta MikroTik RouterOS v7 ao FreeRADIUS.
- O cliente acessa o captive portal.
- O sistema autentica, aplica banda, cria sessão, registra logs e mostra no painel.
```

## 12) Passo a passo MikroTik — guia rápido

### Premissas
- LAN da academia: `10.10.10.0/24`
- MikroTik LAN IP: `10.10.10.1`
- Servidor Ubuntu/stack: `10.10.10.10`
- Interface LAN/SSID do Wi-Fi: `bridge-lan`
- Shared secret RADIUS: `troque_este_shared_secret`

### 12.1 Pool DHCP

```routeros
/ip pool add name=pool-hotspot ranges=10.10.10.100-10.10.10.250
/ip dhcp-server network add address=10.10.10.0/24 gateway=10.10.10.1 dns-server=10.10.10.1
/ip dhcp-server add name=dhcp-hotspot interface=bridge-lan address-pool=pool-hotspot lease-time=1h disabled=no
```

### 12.2 DNS local

```routeros
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
```

### 12.3 HotSpot setup

```routeros
/ip hotspot profile add \
  name=hsprof-academia \
  hotspot-address=10.10.10.1 \
  dns-name=wifi.suaacademia.local \
  html-directory=hotspot \
  login-by=http-pap,http-chap \
  radius-accounting=yes \
  radius-interim-update=5m \
  use-radius=yes

/ip hotspot add \
  name=hotspot-academia \
  interface=bridge-lan \
  profile=hsprof-academia \
  address-pool=pool-hotspot \
  disabled=no
```

### 12.4 RADIUS client no MikroTik

```routeros
/radius add \
  service=hotspot \
  address=10.10.10.10 \
  secret=troque_este_shared_secret \
  authentication-port=1812 \
  accounting-port=1813 \
  src-address=10.10.10.1 \
  timeout=1100ms
```

### 12.5 HotSpot usar RADIUS

```routeros
/ip hotspot profile set hsprof-academia use-radius=yes radius-accounting=yes radius-interim-update=5m
```

### 12.6 Walled garden para domínio do portal

Se o domínio do portal estiver fora do próprio MikroTik e você precisar liberar o acesso antes da autenticação:

```routeros
/ip hotspot walled-garden add dst-host=wifi.suaacademia.com.br
/ip hotspot walled-garden add dst-host=api.suaacademia.com.br
```

### 12.7 Testes

```routeros
/radius monitor 0
/log print where topics~"radius|hotspot"
/ip hotspot active print
```

### 12.8 Caso use páginas HTML personalizadas no MikroTik

```routeros
/ip hotspot profile set hsprof-academia html-override-directory=hotspot-custom
```

## 13) Checklist operacional

- [ ] Ubuntu 22.04 atualizado
- [ ] Docker Engine instalado
- [ ] `docker compose up -d` sem erro
- [ ] PostgreSQL saudável
- [ ] FreeRADIUS ouvindo UDP 1812/1813
- [ ] `radtest` funcionando
- [ ] MikroTik alcança o IP do servidor
- [ ] `/radius monitor` mostra requisições
- [ ] HotSpot redireciona corretamente
- [ ] Login autentica no RADIUS
- [ ] Accounting Start/Interim/Stop persiste no banco
- [ ] Plano aplica banda correta
- [ ] Sessão aparece no painel
- [ ] Termos e opt-in de marketing gravados separados
- [ ] Backup do banco testado
- [ ] Restore testado
- [ ] Logs e auditoria validados

## 14) Ponto de arquitetura que eu manteria

- MikroTik como enforcement.
- Servidor externo como source of truth.
- User Manager apenas como opção secundária/laboratório, não como núcleo do negócio.
- Marketing sempre desacoplado do aceite obrigatório de acesso.
