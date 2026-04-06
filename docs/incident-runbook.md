# Incident Runbook

## 1. Falha de autenticacao RADIUS

- verificar `docker compose ps`
- verificar logs do FreeRADIUS com `docker compose logs freeradius`
- testar conectividade do MikroTik para UDP 1812/1813
- consultar `radcheck` para o usuario autenticado
- validar segredo compartilhado em `clients.conf` e no `/radius` do RouterOS

## 2. Painel administrativo fora do ar

- verificar logs de `frontend`, `backend` e `caddy`
- chamar `GET /api/health`
- verificar proxy reverso e DNS

## 3. Banco indisponivel

- validar healthcheck do PostgreSQL
- conferir uso de disco
- executar backup antes de qualquer tentativa destrutiva
- restaurar ultimo dump valido se necessario

## 4. Vazamento ou suspeita de incidente com dados

- isolar acessos administrativos
- coletar logs relevantes
- preservar evidencias
- revisar ultimas entradas em `audit_logs`
- VALIDAR COM JURIDICO e responsavel interno antes de comunicacao externa

