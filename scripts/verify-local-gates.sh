#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: scripts/verify-local-gates.sh [--include-visual] [--include-schema-parity]

Runs the repository's local quality gates from the repository root.

Default gates:
  - backend MockMvc/JPA tests
  - frontend typecheck
  - frontend runtime config contract
  - frontend production build
  - deploy env validator happy path
  - deploy env validator prod-template rejection
  - UI route/API contract matrix validator

Optional gates:
  --include-visual        Run authenticated visual QA. Requires backend on
                          127.0.0.1:8080 and Vite on 127.0.0.1:5173 unless
                          TOMODACHI_* URL variables override them.
  --include-schema-parity Run PostgreSQL schema parity. Requires Docker and a
                          local postgres:16-alpine image because the parity
                          verifier intentionally uses --pull=never.
USAGE
}

include_visual=false
include_schema_parity=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --include-visual)
      include_visual=true
      shift
      ;;
    --include-schema-parity)
      include_schema_parity=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      printf 'local-gates: unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

repo_root=$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)

run_step() {
  label=$1
  shift
  printf 'local-gates: START %s\n' "$label"
  "$@"
  printf 'local-gates: PASS %s\n' "$label"
}

run_backend_tests() {
  (cd "$repo_root/backend" && ./gradlew test)
}

run_front_typecheck() {
  (cd "$repo_root/front" && npm run typecheck)
}

run_front_runtime_config() {
  (cd "$repo_root/front" && npm run verify:runtime-config)
}

run_front_build() {
  (cd "$repo_root/front" && npm run build)
}

run_visual_qa() {
  qa_dir=${TOMODACHI_FRONT_QA_DIR:-}
  if [ -n "$qa_dir" ]; then
    case "$qa_dir" in
      /*) ;;
      *) export TOMODACHI_FRONT_QA_DIR="$repo_root/$qa_dir" ;;
    esac
  fi
  (cd "$repo_root/front" && npm run visual:qa)
}

run_ui_contract() {
  (cd "$repo_root" && node scripts/validate-ui-contract-plan.mjs \
    --plan plan/ui-ux-mvp-flow.md \
    --routes front/src/router.tsx \
    --controllers backend/src/main/kotlin/com/tomodachi/backend/api)
}

run_step "backend tests" run_backend_tests
run_step "frontend typecheck" run_front_typecheck
run_step "frontend runtime config" run_front_runtime_config
run_step "frontend build" run_front_build
run_step "deploy dev env validation" "$repo_root/deploy/validate-compose-env.sh" --env-file "$repo_root/deploy/env.dev.template"

printf 'local-gates: START deploy prod template rejection\n'
if "$repo_root/deploy/validate-compose-env.sh" --env-file "$repo_root/deploy/env.prod.template"; then
  printf 'local-gates: prod template unexpectedly passed validation\n' >&2
  exit 1
fi
printf 'local-gates: PASS deploy prod template rejection\n'

run_step "UI route/API contract matrix" run_ui_contract

if [ "$include_schema_parity" = true ]; then
  run_step "PostgreSQL schema parity" "$repo_root/scripts/verify-schema-parity.sh" \
    --fixture "$repo_root/scripts/fixtures/schema-parity/expected.json"
else
  printf 'local-gates: SKIP PostgreSQL schema parity; pass --include-schema-parity to run Docker-backed validation\n'
fi

if [ "$include_visual" = true ]; then
  run_step "authenticated visual QA" run_visual_qa
else
  printf 'local-gates: SKIP authenticated visual QA; pass --include-visual after starting backend and frontend\n'
fi

printf 'local-gates: PASS all requested gates\n'
