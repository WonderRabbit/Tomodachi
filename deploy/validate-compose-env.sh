#!/usr/bin/env sh
set -eu

# SIZE_OK: This single-file POSIX sh validator intentionally preserves security-sensitive .env key/control-character parsing, dev/prod env filename classification, production secret/domain/email placeholder rejection, Docker image/tag syntax checks, and no external runtime dependency before Compose deploy/config use.

usage() {
  cat <<'USAGE'
Usage: deploy/validate-compose-env.sh --env-file <path>

Validates the Docker image variables used by the Tomodachi dev/prod Compose
overlays before running docker compose config, pull, or up.
USAGE
}

env_file=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      if [ "$#" -lt 2 ]; then
        echo "error: --env-file requires a path" >&2
        exit 2
      fi
      env_file=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$env_file" ]; then
  echo "error: missing --env-file" >&2
  usage >&2
  exit 2
fi

if [ ! -f "$env_file" ]; then
  echo "error: env file not found: $env_file" >&2
  exit 2
fi

load_env_file() {
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%"$(printf '\r')"}
    case "$line" in
      ''|\#*) continue ;;
      *=*) ;;
      *)
        echo "error: invalid env line in $env_file: $line" >&2
        exit 2
        ;;
    esac

    if printf '%s' "$line" | LC_ALL=C grep -Eq '[[:cntrl:]]'; then
      echo "error: control character in env line for $env_file: ${line%%=*}" >&2
      exit 2
    fi

    key=${line%%=*}
    value=${line#*=}

    case "$key" in
      ''|*[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_]*|[0123456789]*)
        echo "error: invalid env key in $env_file: $key" >&2
        exit 2
        ;;
    esac

    if eval '[ "${'"$key"'+x}" = x ]'; then
      continue
    fi

    export "$key=$value"
  done < "$env_file"
}

failures=0

report_error() {
  echo "error: $1" >&2
  failures=$((failures + 1))
}

has_newline() {
  case "$1" in
    *"
"*) return 0 ;;
    *) return 1 ;;
  esac
}

has_control_character() {
  value=$1

  if has_newline "$value"; then
    return 0
  fi

  printf '%s' "$value" | LC_ALL=C tr -d '\n' | grep -Eq '[[:cntrl:]]'
}

is_set() {
  eval '[ "${'"$1"'+x}" = x ]'
}

read_var() {
  eval 'printf "%s" "${'"$1"'-}"'
}

validate_tag() {
  name=$1
  value=$2

  if [ -z "$value" ]; then
    report_error "$name must not be empty"
    return
  fi

  if [ "${#value}" -gt 128 ]; then
    report_error "$name must be 128 characters or less"
    return
  fi

  if ! printf '%s\n' "$value" | grep -Eq '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$'; then
    report_error "$name has invalid Docker tag syntax: '$value' (examples: latest, main-abc1234, v1.2.3, 2026.06.29-abc)"
  fi
}

validate_image_base() {
  name=$1
  value=$2

  if [ -z "$value" ]; then
    report_error "$name must not be empty for dev/prod overlays"
    return
  fi

  if printf '%s\n' "$value" | grep -Eq '[[:space:][:cntrl:]]'; then
    report_error "$name must not contain whitespace or control characters: '$value'"
    return
  fi

  case "$value" in
    *://*|*@*|//*|/*|*/)
      report_error "$name must be an image repository without scheme, digest, empty path segment, or edge slash: '$value'"
      return
      ;;
  esac

  last_segment=${value##*/}
  case "$last_segment" in
    *:*)
      report_error "$name must omit the tag because TOMODACHI_IMAGE_TAG is appended separately: '$value'"
      return
      ;;
  esac

  if ! printf '%s\n' "$value" | grep -Eq '^[a-z0-9][a-z0-9._:/-]*[a-z0-9]$'; then
    report_error "$name has invalid Docker image repository syntax: '$value'"
  fi
}

validate_scalar_value() {
  name=$1
  value=$2
  required=$3

  if [ -z "$value" ]; then
    if [ "$required" = true ]; then
      report_error "$name must not be empty"
    fi
    return
  fi

  if has_control_character "$value"; then
    report_error "$name must not contain control characters or raw newlines"
  fi
}

validate_prod_secret_value() {
  name=$1
  value=$2

  validate_scalar_value "$name" "$value" true

  case "$value" in
    *__REQUIRED_PROD_SECRET__*|*prod*postgres*password*placeholder*|*placeholder*|*CHANGE_ME*|*changeme*)
      report_error "$name must be a real production secret, not a placeholder or template sentinel"
      ;;
  esac
}

validate_prod_domain_value() {
  name=$1
  value=$2

  validate_scalar_value "$name" "$value" true

  lower_value=$(printf '%s' "$value" | LC_ALL=C tr '[:upper:]' '[:lower:]')
  case "$lower_value" in
    example.com|*.example.com|*placeholder*|*change_me*|*changeme*)
      report_error "$name must be a real production domain, not an example.com placeholder or template sentinel"
      ;;
  esac
}

validate_prod_email_value() {
  name=$1
  value=$2

  validate_scalar_value "$name" "$value" true

  lower_value=$(printf '%s' "$value" | LC_ALL=C tr '[:upper:]' '[:lower:]')
  case "$lower_value" in
    ops@example.com|*@example.com|*@*.example.com|*placeholder*|*change_me*|*changeme*)
      report_error "$name must be a real production TLS email, not an example.com placeholder or template sentinel"
      ;;
  esac
}

validate_if_set() {
  name=$1
  required=$2

  if is_set "$name"; then
    validate_scalar_value "$name" "$(read_var "$name")" "$required"
  elif [ "$required" = true ]; then
    report_error "$name is required"
  fi
}

is_dev_env_file_name() {
  base=${env_file##*/}

  case "$base" in
    .env.dev|env.dev|dev.env|deploy.env.dev|env.dev.template|*.dev|*.dev.env|*.env.dev|*.dev.template)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_prod_env_file_name() {
  base=${env_file##*/}

  case "$base" in
    .env.prod|env.prod|prod.env|deploy.env.prod|env.prod.template|*.prod|*.prod.env|*.env.prod|*.prod.template)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

load_env_file

env_name=${TOMODACHI_ENV:-}
if [ "$env_name" = dev ] || [ "$env_name" = prod ] || is_dev_env_file_name || is_prod_env_file_name; then
  require_release_images=true
else
  require_release_images=false
fi

if [ "$env_name" = prod ] || is_prod_env_file_name; then
  prod_env=true
else
  prod_env=false
fi

for name in SPRING_PROFILES_ACTIVE COMPOSE_PROJECT_NAME POSTGRES_DB POSTGRES_USER POSTGRES_PORT TOMODACHI_DATABASE_URL TOMODACHI_DATABASE_USER TOMODACHI_DOMAIN TOMODACHI_TLS_EMAIL TOMODACHI_PUBLIC_HTTP_BIND TOMODACHI_PUBLIC_HTTPS_BIND TOMODACHI_DB_VOLUME TOMODACHI_BACKUP_VOLUME; do
  validate_if_set "$name" false
done

if [ "$prod_env" = true ]; then
  for name in POSTGRES_PASSWORD TOMODACHI_DATABASE_PASSWORD; do
    if is_set "$name"; then
      validate_prod_secret_value "$name" "$(read_var "$name")"
    else
      report_error "$name is required for prod deploy env files"
    fi
  done

  if is_set TOMODACHI_DOMAIN; then
    validate_prod_domain_value TOMODACHI_DOMAIN "$(read_var TOMODACHI_DOMAIN)"
  else
    report_error "TOMODACHI_DOMAIN is required for prod deploy env files"
  fi

  if is_set TOMODACHI_TLS_EMAIL; then
    validate_prod_email_value TOMODACHI_TLS_EMAIL "$(read_var TOMODACHI_TLS_EMAIL)"
  else
    report_error "TOMODACHI_TLS_EMAIL is required for prod deploy env files"
  fi
else
  validate_if_set POSTGRES_PASSWORD false
  validate_if_set TOMODACHI_DATABASE_PASSWORD false
fi

if [ "${TOMODACHI_IMAGE_TAG+x}" = x ]; then
  validate_tag TOMODACHI_IMAGE_TAG "$TOMODACHI_IMAGE_TAG"
elif [ "$require_release_images" = true ]; then
  report_error "TOMODACHI_IMAGE_TAG is required for dev/prod overlays"
fi

if [ "${TOMODACHI_BACKEND_IMAGE+x}" = x ]; then
  validate_image_base TOMODACHI_BACKEND_IMAGE "$TOMODACHI_BACKEND_IMAGE"
elif [ "$require_release_images" = true ]; then
  report_error "TOMODACHI_BACKEND_IMAGE is required for dev/prod overlays"
fi

if [ "${TOMODACHI_FRONTEND_IMAGE+x}" = x ]; then
  validate_image_base TOMODACHI_FRONTEND_IMAGE "$TOMODACHI_FRONTEND_IMAGE"
elif [ "$require_release_images" = true ]; then
  report_error "TOMODACHI_FRONTEND_IMAGE is required for dev/prod overlays"
fi

if [ "$failures" -ne 0 ]; then
  echo "Tomodachi deploy env validation failed for $env_file" >&2
  exit 1
fi

echo "Tomodachi deploy env validation passed for $env_file"
