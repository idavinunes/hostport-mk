# Wi-Fi Portal para Academia

Projeto base para captive portal com MikroTik RouterOS v7, FreeRADIUS, PostgreSQL, FastAPI, Next.js e Caddy, com foco em rastreabilidade de sessao, operacao simples e adequacao inicial a LGPD.

## Stack

- Ubuntu 22.04 no host
- Docker Engine + Docker Compose
- PostgreSQL 16
- FreeRADIUS 3
- FastAPI
- Next.js 15
- Caddy 2

## O que este MVP entrega

- API administrativa com autenticacao por JWT
- Cadastro de clientes, dispositivos, planos e roteadores
- Estrutura SQL para accounting RADIUS
- Views `radcheck` e `radreply` derivadas do banco principal
- Painel web administrativo basico
- Gerador visual de script MikroTik para RouterOS v6 e v7
- Configuracao central da operacao para validar uma unica empresa
- Scripts de bootstrap, deploy, backup e restore
- Documentacao operacional e juridica inicial

## Observacoes de arquitetura

- O documento original nao definia a credencial de acesso Wi-Fi do cliente. Neste MVP, cada cliente possui `wifi_username` e `wifi_password_hash`.
- O Caddy foi configurado para um dominio publico real. Se voce usar dominio interno ou ambiente de laboratorio, ajuste o arquivo [`infra/caddy/Caddyfile`](./infra/caddy/Caddyfile).
- O fluxo de portal publico para autoatendimento do aluno foi reduzido ao essencial. O foco aqui e colocar a base administrativa e o RADIUS em pe.
- A fase atual esta orientada para uma unica empresa, com varios MikroTiks possiveis dentro da mesma operacao.

## Subida local

1. Copie o ambiente:

```bash
cp .env.example .env
```

2. Gere uma chave Fernet para `APP_ENCRYPTION_KEY`:

```bash
python3 - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```

3. Suba a stack:

```bash
docker compose up -d --build
```

4. Acesse:

- Admin UI: `http://localhost:3000`
- API: `http://localhost:8000/docs`

## Credenciais administrativas iniciais

- Usuario: definido por `ADMIN_USERNAME`
- Senha: definida por `ADMIN_PASSWORD`

## Estrutura principal

```text
.
├── backend
├── docs
├── frontend
├── infra
├── scripts
├── docker-compose.yml
└── .env.example
```

## Operacao em producao

- Execute `scripts/01-bootstrap-ubuntu.sh` no host Ubuntu 22.04.
- Ajuste `.env` com um FQDN valido e segredos fortes.
- Rode `scripts/03-deploy-stack.sh`.
- Siga [`docs/mikrotik-integration.md`](./docs/mikrotik-integration.md) para integrar o RouterOS.

## Checklist rapido

- [ ] `.env` preenchido com segredos reais
- [ ] `APP_ENCRYPTION_KEY` gerada corretamente
- [ ] `docker compose ps` sem servicos unhealthy
- [ ] `radcheck` e `radreply` retornando dados
- [ ] MikroTik apontando para o servidor na porta UDP 1812/1813
- [ ] Login RADIUS funcionando com um cliente ativo
