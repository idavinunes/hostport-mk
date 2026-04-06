# Wi-Fi Portal Controlado

Projeto base para captive portal com MikroTik RouterOS, FreeRADIUS, PostgreSQL, FastAPI, Next.js e Caddy, com foco em rastreabilidade de sessao, operacao simples e adequacao inicial a LGPD.

Ele nao e exclusivo para academia. A base foi pensada para qualquer operacao que queira oferecer Wi-Fi de forma controlada, como academias, clinicas, coworkings, escritorios, eventos, igrejas, escolas, condominios, bares, restaurantes e hoteis.

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
- Integracao ativa com MikroTik via API nativa para teste de conexao
- Emissao de vouchers com escrita em `/ip/hotspot/user`
- Leitura operacional de usuarios online direto do HotSpot
- Configuracao central da operacao para validar uma unica empresa
- Scripts de bootstrap, deploy, backup e restore
- Documentacao operacional e juridica inicial

## Observacoes de arquitetura

- O documento original nao definia a credencial de acesso Wi-Fi do cliente. Neste MVP, cada cliente possui `wifi_username` e `wifi_password_hash`.
- O Caddy foi configurado para um dominio publico real. Se voce usar dominio interno ou ambiente de laboratorio, ajuste o arquivo [`infra/caddy/Caddyfile`](./infra/caddy/Caddyfile).
- O fluxo de portal publico de autoatendimento foi reduzido ao essencial. O foco aqui e colocar a base administrativa e o RADIUS em pe.
- A fase atual esta orientada para uma unica empresa, com varios MikroTiks possiveis dentro da mesma operacao.
- Para integracao ativa com o roteador, cadastre usuario e senha da API RouterOS no menu de roteadores. A leitura/escrita ativa usa a API nativa nas portas `8728` ou `8729`.

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

## Instalacao Guiada

Este e o fluxo recomendado para subir o projeto em um servidor `Ubuntu 22.04`.

### 1. Preparar o servidor

No servidor, clone o repositorio e entre na pasta do projeto:

```bash
git clone https://github.com/idavinunes/hostport-mk.git
cd hostport-mk
```

Antes da instalacao, confirme:

- o servidor esta com `Ubuntu 22.04`
- o dominio publico do portal ja aponta para o IP do servidor
- o MikroTik consegue chegar ao servidor nas portas UDP `1812` e `1813`
- se for usar integracao ativa, a API do RouterOS estara liberada em `8728` ou `8729`

### 2. Rodar o instalador principal

Use o script [`scripts/00-install-ubuntu-22.04.sh`](./scripts/00-install-ubuntu-22.04.sh), que e o ponto de entrada recomendado:

```bash
sudo bash scripts/00-install-ubuntu-22.04.sh \
  --domain wifi.suaempresa.com.br \
  --email infra@suaempresa.com.br \
  --mikrotik-ip 10.10.10.1 \
  --mikrotik-name mikrotik-matriz \
  --admin-user admin
```

Esse script:

- valida se o host e `Ubuntu 22.04`
- instala Docker e dependencias do sistema
- executa o hardening basico do host
- cria ou atualiza o `.env`
- gera segredos ausentes automaticamente
- implanta a stack em `/opt/wifi-portal`

Se preferir ver todas as opcoes disponiveis:

```bash
bash scripts/00-install-ubuntu-22.04.sh --help
```

### 3. Entender a sequencia dos scripts

O instalador principal chama os scripts menores. Eles tambem podem ser usados manualmente quando voce quiser controlar melhor a operacao:

- [`scripts/01-bootstrap-ubuntu.sh`](./scripts/01-bootstrap-ubuntu.sh): instala Docker, utilitarios e prepara o diretorio de deploy.
- [`scripts/02-hardening-basic.sh`](./scripts/02-hardening-basic.sh): aplica firewall basico, `fail2ban` e persistencia de logs no host.
- [`scripts/03-deploy-stack.sh`](./scripts/03-deploy-stack.sh): copia o projeto para `/opt/wifi-portal` e sobe a stack com `docker compose`.
- [`scripts/04-backup-postgres.sh`](./scripts/04-backup-postgres.sh): gera backup compactado do PostgreSQL em `/opt/wifi-portal/backups`.
- [`scripts/05-restore-postgres.sh`](./scripts/05-restore-postgres.sh): restaura um backup do PostgreSQL a partir de um arquivo `.sql.gz`.
- [`scripts/06-rotate-logs.sh`](./scripts/06-rotate-logs.sh): remove backups antigos conforme a politica simples atual.

### 4. Validar a stack apos a instalacao

Depois da instalacao, entre no diretorio implantado:

```bash
cd /opt/wifi-portal
docker compose ps
docker compose logs --tail=100 backend frontend freeradius caddy
```

O esperado e:

- `postgres`, `backend`, `frontend`, `freeradius` e `caddy` em execucao
- `backend` respondendo em `/api/health`
- `frontend` servindo o painel

### 5. Acessar o painel

Abra no navegador:

- Painel admin: `https://SEU_DOMINIO`
- OpenAPI: `https://SEU_DOMINIO/docs`

As credenciais iniciais sao as definidas no instalador ou no `.env`:

- Usuario: `ADMIN_USERNAME`
- Senha: `ADMIN_PASSWORD`

### 6. Configurar a operacao no painel

No primeiro acesso, siga esta ordem:

1. `Configuracoes`: preencha nome da operacao, dominio do portal, dominio da API e IP do servidor RADIUS.
2. `Roteadores`: cadastre o MikroTik, os parametros de HotSpot e, se quiser integracao ativa, informe usuario e senha da API RouterOS.
3. `Planos`: crie os perfis de banda e timeout.
4. `Clientes` e `Dispositivos`: cadastre a base inicial.
5. `MikroTik`: gere o script de configuracao v6 ou v7 para aplicar no roteador.

### 7. Integrar o MikroTik

Depois do cadastro do roteador:

1. abra a tela `MikroTik`
2. selecione o roteador cadastrado
3. gere o script para `RouterOS v6` ou `RouterOS v7`
4. aplique o script no MikroTik
5. confirme no roteador se o RADIUS esta enviando requisicoes

O guia complementar esta em [`docs/mikrotik-integration.md`](./docs/mikrotik-integration.md).

### 8. Validar o fluxo real

Depois da integracao, valide:

1. login no captive portal
2. criacao de sessao em `Sessoes`
3. accounting em `radacct`
4. emissao de voucher em `Vouchers`
5. leitura de usuarios online em `Online`

### 9. Operacao de backup e restore

Para gerar backup:

```bash
bash scripts/04-backup-postgres.sh
```

Para restaurar um backup:

```bash
bash scripts/05-restore-postgres.sh /opt/wifi-portal/backups/arquivo.sql.gz
```

Para limpeza simples de backups antigos:

```bash
bash scripts/06-rotate-logs.sh
```

### Exemplo de instalacao automatizada

```bash
sudo bash scripts/00-install-ubuntu-22.04.sh \
  --domain wifi.suaempresa.com.br \
  --email infra@suaempresa.com.br \
  --mikrotik-ip 10.10.10.1 \
  --mikrotik-name mikrotik-matriz \
  --admin-user admin
```

O script gera os segredos ausentes automaticamente e grava tudo em `.env`.

## Fluxo Manual

Se voce nao quiser usar o instalador `00`, a sequencia manual recomendada e:

```bash
sudo bash scripts/01-bootstrap-ubuntu.sh
sudo bash scripts/02-hardening-basic.sh
cp .env.example .env
sudo bash scripts/03-deploy-stack.sh
```

Depois disso, siga a mesma configuracao funcional pelo painel.

## Checklist rapido

- [ ] `.env` preenchido com segredos reais
- [ ] `APP_ENCRYPTION_KEY` gerada corretamente
- [ ] `docker compose ps` sem servicos unhealthy
- [ ] `radcheck` e `radreply` retornando dados
- [ ] MikroTik apontando para o servidor na porta UDP 1812/1813
- [ ] Login RADIUS funcionando com um cliente ativo
