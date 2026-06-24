#!/usr/bin/env zsh
emulate -L zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"
ENV_FILE="${TOMODACHI_DEPLOY_ENV:-$ROOT_DIR/deploy/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$ROOT_DIR/deploy/.env.example"
fi
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.yml"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh [up|down|restart|status|logs|doctor|config|reset-db]

Commands:
  up        Build and start Postgres, backend, and frontend. This is the default.
  down      Stop the stack without deleting the database volume.
  restart   Restart services without deleting the database volume.
  status    Show compose status; reports Docker daemon availability.
  logs      Tail stack logs.
  doctor    Check local prerequisites and selected env file.
  config    Render the effective Docker Compose config.
  reset-db  Stop the stack and delete the Postgres volume, then start fresh.
USAGE
}

env_value() {
  local key="$1"
  local fallback="$2"
  local line=""
  if [[ -f "$ENV_FILE" ]]; then
    line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  fi
  if [[ -n "$line" ]]; then
    print -r -- "${line#*=}"
  else
    print -r -- "$fallback"
  fi
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --project-directory "$ROOT_DIR" "$@"
}

docker_daemon_available() {
  docker info >/dev/null 2>&1
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    print -u2 -- "Missing required command: $command_name"
    return 1
  fi
}

require_docker_daemon() {
  require_command docker
  if ! docker compose version >/dev/null 2>&1; then
    print -u2 -- "Docker Compose plugin is not available. Install Docker Desktop or Docker Engine with Compose."
    return 1
  fi
  if ! docker_daemon_available; then
    print -u2 -- "Docker daemon is not running. Start Docker Desktop, then retry."
    return 1
  fi
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local delay_seconds="${4:-2}"

  for attempt in {1..$attempts}; do
    if command -v curl >/dev/null 2>&1 && curl -fsS "$url" >/dev/null 2>&1; then
      print -- "$label is ready at $url"
      return 0
    fi
    sleep "$delay_seconds"
  done

  print -u2 -- "$label did not become ready at $url"
  return 1
}

doctor() {
  print -- "Tomodachi deploy doctor"
  print -- "repo: $ROOT_DIR"
  print -- "env: $ENV_FILE"
  print -- "zsh: ${ZSH_VERSION:-unknown}"
  require_command git
  print -- "git: $(git --version)"
  require_command docker
  print -- "docker: $(docker --version)"
  print -- "compose: $(docker compose version)"
  if docker_daemon_available; then
    print -- "docker-daemon: running"
  else
    print -- "docker-daemon: not running (start Docker Desktop before 'up')"
  fi
}

command_name="${1:-up}"
case "$command_name" in
  up)
    require_docker_daemon
    compose up -d --build
    backend_port="$(env_value TOMODACHI_BACKEND_PORT 8080)"
    frontend_port="$(env_value TOMODACHI_FRONTEND_PORT 5173)"
    wait_for_http "http://127.0.0.1:${backend_port}/actuator/health" "backend"
    print -- "frontend is available at http://127.0.0.1:${frontend_port}"
    ;;
  down)
    compose down
    ;;
  restart)
    require_docker_daemon
    compose restart
    ;;
  status)
    if docker_daemon_available; then
      compose ps
    else
      print -- "Docker daemon is not running; no live Tomodachi status is available."
    fi
    ;;
  logs)
    require_docker_daemon
    compose logs -f --tail=200
    ;;
  doctor)
    doctor
    ;;
  config)
    compose config
    ;;
  reset-db)
    require_docker_daemon
    compose down -v
    compose up -d --build
    backend_port="$(env_value TOMODACHI_BACKEND_PORT 8080)"
    wait_for_http "http://127.0.0.1:${backend_port}/actuator/health" "backend"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    print -u2 -- "Unknown command: $command_name"
    usage >&2
    exit 2
    ;;
esac
