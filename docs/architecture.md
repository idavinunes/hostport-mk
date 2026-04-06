# Arquitetura

## Visao geral

O projeto separa a responsabilidade de controle de acesso em duas partes:

- MikroTik faz o enforcement do acesso, captive portal e accounting.
- Stack Ubuntu centraliza cadastro, regras, auditoria e persistencia.

## Componentes

### MikroTik

- HotSpot habilitado no RouterOS v7.
- RADIUS apontando para o FreeRADIUS externo.
- `radius-accounting=yes` para registrar inicio, atualizacoes e encerramento de sessao.

### FreeRADIUS

- Consulta `radcheck` para autenticacao.
- Consulta `radreply` para atributos como `Mikrotik-Rate-Limit`.
- Persiste accounting em `radacct`.

### PostgreSQL

- Banco transacional principal para clientes, planos, dispositivos e roteadores.
- Views de integracao para o FreeRADIUS.
- Tabela de accounting padrao (`radacct`) e trilha de auditoria (`audit_logs`).

### Backend FastAPI

- API administrativa.
- Validacao, hashing e criptografia de dados sensiveis.
- Emissao de JWT para o painel administrativo.
- Escrita de auditoria para eventos administrativos.

### Frontend Next.js

- Painel web basico para operacao.
- Login administrativo.
- CRUD basico para clientes, planos, dispositivos e roteadores.
- Visualizacao de sessoes ativas e auditoria.

### Caddy

- TLS e reverse proxy.
- Encaminha `/api/*` para o backend.
- Encaminha demais rotas para o frontend.

## Fluxo de autenticacao

1. Cliente entra no SSID controlado pelo MikroTik.
2. HotSpot exige autenticacao.
3. MikroTik consulta o FreeRADIUS.
4. FreeRADIUS valida `wifi_username` e `wifi_password_hash` via `radcheck`.
5. FreeRADIUS devolve atributos de sessao via `radreply`.
6. Accounting e gravado em `radacct`.
7. Painel administrativo consulta `radacct` para status operacional.

## Fluxo de dados sensiveis

- CPF e MAC sao armazenados em dois formatos:
  - hash SHA-256 normalizado para lookup
  - ciphertext com Fernet para recuperacao controlada no app
- O frontend recebe versoes mascaradas para reduzir exposicao.
- Aceite de marketing fica separado dos termos obrigatorios de uso.

## Decisoes principais

- Servidor externo como source of truth, nao User Manager.
- PAP como modo minimo suportado no HotSpot para compatibilidade com password hash no servidor.
- Banco unico para regras de negocio e RADIUS, reduzindo duplicacao operacional.

## Riscos conhecidos

- VALIDAR COM JURIDICO: base legal exata para uso de CPF como identificador principal.
- Portal publico de autoatendimento ainda esta em escopo reduzido no MVP.
- Em ambiente sem dominio publico, o modelo de TLS do Caddy precisa ajuste.

