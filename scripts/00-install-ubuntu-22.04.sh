#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_EXAMPLE_FILE="${REPO_ROOT}/.env.example"
ENV_FILE="${REPO_ROOT}/.env"

INSTALL_DIR="${INSTALL_DIR:-/opt/wifi-portal}"
OPERATOR_USER="${OPERATOR_USER:-}"
TZ_VALUE="${TZ:-}"
PROJECT_NAME="${PROJECT_NAME:-}"
POSTGRES_DB="${POSTGRES_DB:-}"
POSTGRES_USER="${POSTGRES_USER:-}"
DOMAIN="${DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
ADMIN_FULL_NAME="${ADMIN_FULL_NAME:-}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-}"
MIKROTIK_RADIUS_SECRET="${MIKROTIK_RADIUS_SECRET:-}"
MIKROTIK_NAS_IP="${MIKROTIK_NAS_IP:-}"
MIKROTIK_NAS_NAME="${MIKROTIK_NAS_NAME:-}"
MIKROTIK_SRC_IP="${MIKROTIK_SRC_IP:-}"
CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-}"
NON_INTERACTIVE=0
SKIP_HARDENING=0
ENV_CREATED=0

GENERATED_ADMIN_PASSWORD=0
GENERATED_POSTGRES_PASSWORD=0
GENERATED_JWT_SECRET=0
GENERATED_APP_ENCRYPTION_KEY=0
GENERATED_RADIUS_SECRET=0

usage() {
  cat <<'EOF'
Uso:
  sudo bash scripts/00-install-ubuntu-22.04.sh [opcoes]

Opcoes:
  --domain HOST                Dominio publico do portal
  --email EMAIL                Email usado pelo Caddy/ACME
  --admin-user USER            Usuario administrativo inicial
  --admin-password PASS        Senha administrativa inicial
  --admin-name NAME            Nome exibido do administrador
  --mikrotik-ip IP             IP do MikroTik autorizado no FreeRADIUS
  --mikrotik-name NAME         Nome do NAS no FreeRADIUS
  --operator-user USER         Usuario do sistema que vai operar o projeto
  --install-dir DIR            Diretorio final da stack
  --timezone TZ                Timezone do servidor
  --project-name NAME          Valor de PROJECT_NAME
  --postgres-db NAME           Valor de POSTGRES_DB
  --postgres-user USER         Valor de POSTGRES_USER
  --postgres-password PASS     Valor de POSTGRES_PASSWORD
  --jwt-secret VALUE           Valor de JWT_SECRET
  --app-key VALUE              Valor de APP_ENCRYPTION_KEY
  --radius-secret VALUE        Shared secret do MikroTik no FreeRADIUS
  --cors-origins VALUE         Valor final de CORS_ALLOWED_ORIGINS
  --skip-hardening             Nao executa scripts/02-hardening-basic.sh
  --yes                        Nao faz perguntas interativas
  --help                       Mostra esta ajuda

Observacoes:
  - Segredos ausentes sao gerados automaticamente.
  - O script exige Ubuntu 22.04 e privilegios de root.
  - O deploy final usa os scripts existentes de bootstrap e deploy.
EOF
}

log() {
  printf '[install] %s\n' "$*"
}

fail() {
  printf '[install] erro: %s\n' "$*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "execute com sudo ou como root"
}

require_ubuntu_2204() {
  source /etc/os-release
  [[ "${ID}" == "ubuntu" && "${VERSION_ID}" == "22.04" ]] || fail "suportado apenas em Ubuntu 22.04"
}

require_file() {
  local path="$1"
  [[ -f "${path}" ]] || fail "arquivo obrigatorio nao encontrado: ${path}"
}

current_env_value() {
  local key="$1"

  [[ -f "${ENV_FILE}" ]] || return 0
  awk -F= -v key="${key}" '$1 == key { sub(/^[^=]*=/, "", $0); print $0; exit }' "${ENV_FILE}"
}

sanitize_existing_value() {
  local key="$1"
  local value="$2"

  case "${key}:${value}" in
    POSTGRES_PASSWORD:change_me_postgres|JWT_SECRET:change_me_long_random_string|APP_ENCRYPTION_KEY:replace_with_a_fernet_key|MIKROTIK_RADIUS_SECRET:change_me_radius_secret|ADMIN_PASSWORD:Admin123)
      printf ''
      ;;
    *)
      printf '%s' "${value}"
      ;;
  esac
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp

  tmp="$(mktemp)"
  awk -F= -v key="${key}" -v value="${value}" '
    BEGIN { updated = 0 }
    $1 == key {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "${ENV_FILE}" >"${tmp}"
  mv "${tmp}" "${ENV_FILE}"
}

normalize_host() {
  local value="$1"

  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  printf '%s' "${value}"
}

public_origin_from_domain() {
  local host="$1"

  if [[ "${host}" == http://* || "${host}" == https://* ]]; then
    printf '%s' "${host}"
    return
  fi

  printf 'https://%s' "${host}"
}

prompt_value() {
  local var_name="$1"
  local prompt_text="$2"
  local default_value="$3"
  local input=""

  if [[ "${NON_INTERACTIVE}" -eq 1 ]]; then
    printf -v "${var_name}" '%s' "${default_value}"
    return
  fi

  read -r -p "${prompt_text} [${default_value}]: " input
  printf -v "${var_name}" '%s' "${input:-${default_value}}"
}

prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local current_value="${!var_name:-}"
  local input=""

  if [[ "${NON_INTERACTIVE}" -eq 1 ]]; then
    return
  fi

  if [[ -n "${current_value}" ]]; then
    read -r -s -p "${prompt_text} [enter para manter atual]: " input
    echo
    printf -v "${var_name}" '%s' "${input:-${current_value}}"
    return
  fi

  while [[ -z "${input}" ]]; do
    read -r -s -p "${prompt_text}: " input
    echo
  done

  printf -v "${var_name}" '%s' "${input}"
}

confirm_or_abort() {
  local answer=""

  [[ "${NON_INTERACTIVE}" -eq 1 ]] && return

  read -r -p "Continuar com a instalacao? [Y/n] " answer
  answer="${answer:-Y}"
  [[ "${answer}" =~ ^[Yy]$ ]] || fail "instalacao cancelada"
}

generate_hex_secret() {
  local bytes="$1"
  openssl rand -hex "${bytes}"
}

generate_fernet_key() {
  openssl rand -base64 32 | tr '+/' '-_'
}

populate_from_existing_env() {
  local existing_value=""

  existing_value="$(sanitize_existing_value DOMAIN "$(current_env_value DOMAIN)")"
  DOMAIN="${DOMAIN:-${existing_value}}"
  existing_value="$(sanitize_existing_value ACME_EMAIL "$(current_env_value ACME_EMAIL)")"
  ACME_EMAIL="${ACME_EMAIL:-${existing_value}}"
  existing_value="$(sanitize_existing_value TZ "$(current_env_value TZ)")"
  TZ_VALUE="${TZ_VALUE:-${existing_value}}"
  existing_value="$(sanitize_existing_value PROJECT_NAME "$(current_env_value PROJECT_NAME)")"
  PROJECT_NAME="${PROJECT_NAME:-${existing_value}}"
  existing_value="$(sanitize_existing_value POSTGRES_DB "$(current_env_value POSTGRES_DB)")"
  POSTGRES_DB="${POSTGRES_DB:-${existing_value}}"
  existing_value="$(sanitize_existing_value POSTGRES_USER "$(current_env_value POSTGRES_USER)")"
  POSTGRES_USER="${POSTGRES_USER:-${existing_value}}"
  existing_value="$(sanitize_existing_value POSTGRES_PASSWORD "$(current_env_value POSTGRES_PASSWORD)")"
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-${existing_value}}"
  existing_value="$(sanitize_existing_value JWT_SECRET "$(current_env_value JWT_SECRET)")"
  JWT_SECRET="${JWT_SECRET:-${existing_value}}"
  existing_value="$(sanitize_existing_value APP_ENCRYPTION_KEY "$(current_env_value APP_ENCRYPTION_KEY)")"
  APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-${existing_value}}"
  existing_value="$(sanitize_existing_value CORS_ALLOWED_ORIGINS "$(current_env_value CORS_ALLOWED_ORIGINS)")"
  CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-${existing_value}}"
  existing_value="$(sanitize_existing_value ADMIN_USERNAME "$(current_env_value ADMIN_USERNAME)")"
  ADMIN_USERNAME="${ADMIN_USERNAME:-${existing_value}}"
  existing_value="$(sanitize_existing_value ADMIN_PASSWORD "$(current_env_value ADMIN_PASSWORD)")"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-${existing_value}}"
  existing_value="$(sanitize_existing_value ADMIN_FULL_NAME "$(current_env_value ADMIN_FULL_NAME)")"
  ADMIN_FULL_NAME="${ADMIN_FULL_NAME:-${existing_value}}"
  existing_value="$(sanitize_existing_value MIKROTIK_RADIUS_SECRET "$(current_env_value MIKROTIK_RADIUS_SECRET)")"
  MIKROTIK_RADIUS_SECRET="${MIKROTIK_RADIUS_SECRET:-${existing_value}}"
  existing_value="$(sanitize_existing_value MIKROTIK_NAS_IP "$(current_env_value MIKROTIK_NAS_IP)")"
  MIKROTIK_NAS_IP="${MIKROTIK_NAS_IP:-${existing_value}}"
  existing_value="$(sanitize_existing_value MIKROTIK_NAS_NAME "$(current_env_value MIKROTIK_NAS_NAME)")"
  MIKROTIK_NAS_NAME="${MIKROTIK_NAS_NAME:-${existing_value}}"
  existing_value="$(sanitize_existing_value MIKROTIK_SRC_IP "$(current_env_value MIKROTIK_SRC_IP)")"
  MIKROTIK_SRC_IP="${MIKROTIK_SRC_IP:-${existing_value}}"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --email)
        ACME_EMAIL="$2"
        shift 2
        ;;
      --admin-user)
        ADMIN_USERNAME="$2"
        shift 2
        ;;
      --admin-password)
        ADMIN_PASSWORD="$2"
        shift 2
        ;;
      --admin-name)
        ADMIN_FULL_NAME="$2"
        shift 2
        ;;
      --mikrotik-ip)
        MIKROTIK_NAS_IP="$2"
        shift 2
        ;;
      --mikrotik-name)
        MIKROTIK_NAS_NAME="$2"
        shift 2
        ;;
      --operator-user)
        OPERATOR_USER="$2"
        shift 2
        ;;
      --install-dir)
        INSTALL_DIR="$2"
        shift 2
        ;;
      --timezone)
        TZ_VALUE="$2"
        shift 2
        ;;
      --project-name)
        PROJECT_NAME="$2"
        shift 2
        ;;
      --postgres-db)
        POSTGRES_DB="$2"
        shift 2
        ;;
      --postgres-user)
        POSTGRES_USER="$2"
        shift 2
        ;;
      --postgres-password)
        POSTGRES_PASSWORD="$2"
        shift 2
        ;;
      --jwt-secret)
        JWT_SECRET="$2"
        shift 2
        ;;
      --app-key)
        APP_ENCRYPTION_KEY="$2"
        shift 2
        ;;
      --radius-secret)
        MIKROTIK_RADIUS_SECRET="$2"
        shift 2
        ;;
      --cors-origins)
        CORS_ALLOWED_ORIGINS="$2"
        shift 2
        ;;
      --skip-hardening)
        SKIP_HARDENING=1
        shift
        ;;
      --yes)
        NON_INTERACTIVE=1
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        fail "opcao invalida: $1"
        ;;
    esac
  done
}

ensure_operator_user() {
  if [[ -z "${OPERATOR_USER}" ]]; then
    OPERATOR_USER="${SUDO_USER:-}"
  fi

  if [[ -z "${OPERATOR_USER}" || "${OPERATOR_USER}" == "root" ]]; then
    OPERATOR_USER="$(stat -c '%U' "${REPO_ROOT}" 2>/dev/null || echo root)"
  fi

  id "${OPERATOR_USER}" >/dev/null 2>&1 || fail "usuario operador invalido: ${OPERATOR_USER}"
}

prepare_env_file() {
  require_file "${ENV_EXAMPLE_FILE}"
  if [[ ! -f "${ENV_FILE}" ]]; then
    cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
    ENV_CREATED=1
  fi

  if [[ "${ENV_CREATED}" -eq 0 ]]; then
    populate_from_existing_env
  fi
}

collect_configuration() {
  prompt_value DOMAIN "Dominio publico do portal" "${DOMAIN:-wifi.example.com}"
  DOMAIN="$(normalize_host "${DOMAIN}")"

  prompt_value ACME_EMAIL "Email para certificados TLS" "${ACME_EMAIL:-infra@example.com}"
  prompt_value TZ_VALUE "Timezone do servidor" "${TZ_VALUE:-America/Sao_Paulo}"
  prompt_value PROJECT_NAME "Nome do projeto" "${PROJECT_NAME:-wifi-portal}"
  prompt_value POSTGRES_DB "Nome do banco PostgreSQL" "${POSTGRES_DB:-wifi_portal}"
  prompt_value POSTGRES_USER "Usuario do banco PostgreSQL" "${POSTGRES_USER:-wifi_portal}"
  prompt_value ADMIN_USERNAME "Usuario admin inicial" "${ADMIN_USERNAME:-admin}"
  prompt_value ADMIN_FULL_NAME "Nome exibido do admin" "${ADMIN_FULL_NAME:-Administrador}"
  prompt_value MIKROTIK_NAS_IP "IP do MikroTik autorizado no FreeRADIUS" "${MIKROTIK_NAS_IP:-10.10.10.1}"
  prompt_value MIKROTIK_NAS_NAME "Nome do MikroTik no FreeRADIUS" "${MIKROTIK_NAS_NAME:-mikrotik-academia}"
  prompt_secret ADMIN_PASSWORD "Senha do administrador inicial"

  MIKROTIK_SRC_IP="${MIKROTIK_SRC_IP:-${MIKROTIK_NAS_IP}}"
}

generate_missing_secrets() {
  if [[ -z "${POSTGRES_PASSWORD}" ]]; then
    POSTGRES_PASSWORD="$(generate_hex_secret 24)"
    GENERATED_POSTGRES_PASSWORD=1
  fi

  if [[ -z "${JWT_SECRET}" ]]; then
    JWT_SECRET="$(generate_hex_secret 32)"
    GENERATED_JWT_SECRET=1
  fi

  if [[ -z "${APP_ENCRYPTION_KEY}" ]]; then
    APP_ENCRYPTION_KEY="$(generate_fernet_key)"
    GENERATED_APP_ENCRYPTION_KEY=1
  fi

  if [[ -z "${MIKROTIK_RADIUS_SECRET}" ]]; then
    MIKROTIK_RADIUS_SECRET="$(generate_hex_secret 24)"
    GENERATED_RADIUS_SECRET=1
  fi

  if [[ -z "${ADMIN_PASSWORD}" ]]; then
    ADMIN_PASSWORD="$(generate_hex_secret 12)"
    GENERATED_ADMIN_PASSWORD=1
  fi

  if [[ -z "${CORS_ALLOWED_ORIGINS}" ]]; then
    CORS_ALLOWED_ORIGINS="http://localhost:3000,$(public_origin_from_domain "${DOMAIN}")"
  fi
}

show_summary() {
  cat <<EOF

Resumo da instalacao:
  - repo: ${REPO_ROOT}
  - destino: ${INSTALL_DIR}
  - usuario operador: ${OPERATOR_USER}
  - dominio: ${DOMAIN}
  - email TLS: ${ACME_EMAIL}
  - timezone: ${TZ_VALUE}
  - admin inicial: ${ADMIN_USERNAME}
  - MikroTik liberado: ${MIKROTIK_NAS_NAME} (${MIKROTIK_NAS_IP})
  - hardening: $( [[ "${SKIP_HARDENING}" -eq 1 ]] && printf 'nao' || printf 'sim' )

EOF
}

write_env_file() {
  set_env_value TZ "${TZ_VALUE}"
  set_env_value PROJECT_NAME "${PROJECT_NAME}"
  set_env_value DOMAIN "${DOMAIN}"
  set_env_value ACME_EMAIL "${ACME_EMAIL}"
  set_env_value POSTGRES_DB "${POSTGRES_DB}"
  set_env_value POSTGRES_USER "${POSTGRES_USER}"
  set_env_value POSTGRES_PASSWORD "${POSTGRES_PASSWORD}"
  set_env_value JWT_SECRET "${JWT_SECRET}"
  set_env_value APP_ENCRYPTION_KEY "${APP_ENCRYPTION_KEY}"
  set_env_value CORS_ALLOWED_ORIGINS "${CORS_ALLOWED_ORIGINS}"
  set_env_value ADMIN_USERNAME "${ADMIN_USERNAME}"
  set_env_value ADMIN_PASSWORD "${ADMIN_PASSWORD}"
  set_env_value ADMIN_FULL_NAME "${ADMIN_FULL_NAME}"
  set_env_value MIKROTIK_RADIUS_SECRET "${MIKROTIK_RADIUS_SECRET}"
  set_env_value MIKROTIK_NAS_IP "${MIKROTIK_NAS_IP}"
  set_env_value MIKROTIK_NAS_NAME "${MIKROTIK_NAS_NAME}"
  set_env_value MIKROTIK_SRC_IP "${MIKROTIK_SRC_IP}"
}

fix_repo_ownership() {
  if [[ "${OPERATOR_USER}" != "root" ]]; then
    chown "${OPERATOR_USER}:${OPERATOR_USER}" "${ENV_FILE}"
  fi
}

run_installation() {
  log "executando bootstrap do host Ubuntu 22.04"
  SUDO_USER="${OPERATOR_USER}" INSTALL_DIR="${INSTALL_DIR}" bash "${REPO_ROOT}/scripts/01-bootstrap-ubuntu.sh"

  if [[ "${SKIP_HARDENING}" -eq 0 ]]; then
    log "aplicando hardening basico"
    bash "${REPO_ROOT}/scripts/02-hardening-basic.sh"
  fi

  log "gravando configuracao em ${ENV_FILE}"
  write_env_file
  fix_repo_ownership

  log "implantando stack Docker"
  TARGET_DIR="${INSTALL_DIR}" TARGET_OWNER="${OPERATOR_USER}" bash "${REPO_ROOT}/scripts/03-deploy-stack.sh"
}

print_final_notes() {
  local public_origin

  public_origin="$(public_origin_from_domain "${DOMAIN}")"

  cat <<EOF

Instalacao concluida.

- Diretorio da aplicacao: ${INSTALL_DIR}
- Arquivo de ambiente local: ${ENV_FILE}
- Arquivo de ambiente implantado: ${INSTALL_DIR}/.env
- Painel administrativo: ${public_origin}
- API e OpenAPI: ${public_origin}/docs
- Usuario admin inicial: ${ADMIN_USERNAME}

EOF

  if [[ "${GENERATED_ADMIN_PASSWORD}" -eq 1 ]]; then
    printf '%s\n' "- ADMIN_PASSWORD gerada automaticamente: ${ADMIN_PASSWORD}"
  fi

  if [[ "${GENERATED_RADIUS_SECRET}" -eq 1 ]]; then
    printf '%s\n' "- MIKROTIK_RADIUS_SECRET gerado automaticamente: ${MIKROTIK_RADIUS_SECRET}"
  fi

  if [[ "${GENERATED_POSTGRES_PASSWORD}" -eq 1 || "${GENERATED_JWT_SECRET}" -eq 1 || "${GENERATED_APP_ENCRYPTION_KEY}" -eq 1 ]]; then
    printf '%s\n' "- Outros segredos foram gravados no .env; guarde esse arquivo com seguranca."
  fi

  cat <<EOF

Proximos passos:
  1. Aponte o DNS de ${DOMAIN} para este servidor.
  2. Gere o script do MikroTik na UI e aplique no roteador.
  3. Valide o login RADIUS e o accounting antes de colocar em producao.
EOF
}

main() {
  parse_args "$@"
  require_root
  require_ubuntu_2204
  ensure_operator_user
  prepare_env_file
  collect_configuration
  generate_missing_secrets
  show_summary
  confirm_or_abort
  run_installation
  print_final_notes
}

main "$@"
