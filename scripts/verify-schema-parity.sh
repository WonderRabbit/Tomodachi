#!/bin/sh
set -eu

usage() {
  printf '%s\n' 'usage: scripts/verify-schema-parity.sh --fixture <path>' >&2
}

fail() {
  printf 'schema-parity: %s\n' "$1" >&2
  exit "${2:-1}"
}

fixture=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --fixture)
      [ -z "$fixture" ] || fail 'duplicate --fixture' 2
      [ "$#" -ge 2 ] || fail 'missing value for --fixture' 2
      fixture=$2
      shift 2
      ;;
    --help)
      [ "$#" -eq 1 ] || fail 'unexpected arguments after --help' 2
      usage
      exit 0
      ;;
    *)
      usage
      fail "unknown argument: $1" 2
      ;;
  esac
done

[ -n "$fixture" ] || { usage; fail 'required --fixture is missing' 2; }
repo=$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)
[ ! -L "$fixture" ] || fail "fixture symlink is forbidden: $fixture" 2
fixture_dir=$(CDPATH= cd "$(dirname "$fixture")" 2>/dev/null && pwd -P) ||
  fail "fixture directory is unavailable: $fixture" 2
fixture_path="$fixture_dir/$(basename "$fixture")"
[ -f "$fixture_path" ] || fail "fixture is not a regular file: $fixture" 2
case "$fixture_path" in
  "$repo"/*) ;;
  *) fail "fixture must be contained in repository: $fixture" 2 ;;
esac
command -v jq >/dev/null 2>&1 || fail 'jq client is unavailable' 3

fixture_filter='type == "object"
  and (keys | sort) == ["checks", "foreignKeys", "indexes", "tables"]
  and (.tables | type == "array" and all(.[]; type == "string"))
  and (.checks | type == "array" and all(.[];
    type == "object"
    and (keys | sort) == ["definition", "name", "table"]
    and (.table | type == "string")
    and (.name | type == "string")
    and (.definition | type == "string")))
  and (.foreignKeys | type == "array" and all(.[];
    type == "object"
    and (keys | sort) == ["columns", "foreignColumns", "foreignTable", "name", "onDelete", "table"]
    and (.table | type == "string")
    and (.name | type == "string")
    and (.foreignTable | type == "string")
    and (.onDelete | type == "string")
    and (.columns | type == "array" and length > 0 and all(.[]; type == "string"))
    and (.foreignColumns | type == "array" and length > 0 and all(.[]; type == "string"))))
  and (.indexes | type == "array" and all(.[];
    type == "object"
    and (keys | sort) == ["columns", "name", "primary", "table", "unique"]
    and (.table | type == "string")
    and (.name | type == "string")
    and (.unique | type == "boolean")
    and (.primary | type == "boolean")
    and (.columns | type == "array" and length > 0 and all(.[]; type == "string"))))'
tmp_dir=''
run_id=''
ownership_token=''
container=''
candidate_id=''
container_id=''
ownership_unverified=0
backend_pid=''
backend_group=''

cleanup() {
  status=$?
  cleanup_failed=0
  trap - EXIT HUP INT TERM
  if [ -n "$backend_pid" ]; then
    kill -TERM "-$backend_group" >/dev/null 2>&1 ||
      kill -TERM "$backend_pid" >/dev/null 2>&1 || cleanup_failed=1
    attempt=0
    while kill -0 "-$backend_group" >/dev/null 2>&1 && [ "$attempt" -lt 10 ]; do
      attempt=$((attempt + 1))
      sleep 1
    done
    kill -KILL "-$backend_group" >/dev/null 2>&1 || true
    wait "$backend_pid" >/dev/null 2>&1 || true
    if kill -0 "-$backend_group" >/dev/null 2>&1 ||
      kill -0 "$backend_pid" >/dev/null 2>&1; then
      printf 'schema-parity: backend cleanup failed pid=%s group=%s\n' \
        "$backend_pid" "$backend_group" >&2
      cleanup_failed=1
    fi
  fi
  if [ -n "$container_id" ]; then
    owned_metadata=$(docker inspect --format '{{.Id}}|{{.Name}}|{{index .Config.Labels "com.tomodachi.schema-parity.owner"}}' "$container_id" 2>/dev/null || true)
    if [ "$owned_metadata" = "$container_id|/$container|$ownership_token" ]; then
      docker rm -f "$container_id" >/dev/null 2>&1 || cleanup_failed=1
    else
      printf 'schema-parity: refusing cleanup of unverified container id=%s\n' \
        "$container_id" >&2
      cleanup_failed=1
    fi
    if docker inspect "$container_id" >/dev/null 2>&1; then
      printf 'schema-parity: container cleanup failed id=%s\n' "$container_id" >&2
      cleanup_failed=1
    elif ! docker info >/dev/null 2>&1; then
      printf 'schema-parity: container cleanup unverifiable id=%s\n' "$container_id" >&2
      cleanup_failed=1
    fi
  elif [ -n "$candidate_id" ] || [ "$ownership_unverified" -eq 1 ]; then
    printf 'schema-parity: refusing cleanup of unverified candidate id=%s\n' \
      "${candidate_id:-<none>}" >&2
    cleanup_failed=1
  fi
  if [ -n "$tmp_dir" ]; then
    rm -rf "$tmp_dir"
  fi
  if [ "$cleanup_failed" -eq 0 ]; then
    printf 'schema-parity: cleanup complete container=%s\n' "$container" >&2
  else
    printf 'schema-parity: cleanup incomplete container=%s\n' "$container" >&2
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/tomodachi-schema-parity.XXXXXX")
cp -P "$fixture_path" "$tmp_dir/fixture.snapshot.json"
[ ! -L "$fixture_path" ] && [ "$(CDPATH= cd "$(dirname "$fixture_path")" 2>/dev/null && pwd -P)" = "$fixture_dir" ] || fail "fixture path changed during snapshot: $fixture" 2
[ -f "$tmp_dir/fixture.snapshot.json" ] && [ ! -L "$tmp_dir/fixture.snapshot.json" ] || fail "fixture snapshot is not a regular file: $fixture" 2
jq -e "$fixture_filter" -- "$tmp_dir/fixture.snapshot.json" >/dev/null 2>&1 || fail "malformed fixture: $fixture" 2
command -v docker >/dev/null 2>&1 || fail 'ENVIRONMENT_BLOCKED: Docker client is unavailable' 3
docker info >/dev/null 2>&1 || fail 'ENVIRONMENT_BLOCKED: Docker daemon is unavailable' 3
image_id=$(docker image inspect --format '{{.Id}}' postgres:16-alpine 2>/dev/null) || fail 'ENVIRONMENT_BLOCKED: local postgres:16-alpine image is unavailable' 3
case "$image_id" in
  sha256:|sha256:*[!0-9a-f]*) fail 'ENVIRONMENT_BLOCKED: local image ID is malformed' 3 ;;
  sha256:*) ;;
  *) fail 'ENVIRONMENT_BLOCKED: local image ID is malformed' 3 ;;
esac
printf 'schema-parity: local image id=%s\n' "$image_id" >&2
if command -v setsid >/dev/null 2>&1; then
  backend_launcher=setsid
elif command -v perl >/dev/null 2>&1; then
  backend_launcher=perl-setsid
else
  fail 'ENVIRONMENT_BLOCKED: no isolated process-group launcher (setsid or perl)' 3
fi
run_id=$(date +%Y%m%d%H%M%S)-$$
ownership_token=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
[ "${#ownership_token}" -eq 32 ] || fail 'failed to generate ownership token'
container="tomodachi-schema-parity-$run_id-${ownership_token%????????????????}"
password="schema_parity_$ownership_token"
if candidate_id=$(docker run --detach --name "$container" \
  --label "com.tomodachi.schema-parity.owner=$ownership_token" \
  --pull=never \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_DB=tomodachi \
  --env POSTGRES_USER=tomodachi \
  --env "POSTGRES_PASSWORD=$password" "$image_id"); then
  candidate_metadata=$(docker inspect --format '{{.Id}}|{{.Name}}|{{index .Config.Labels "com.tomodachi.schema-parity.owner"}}' "$candidate_id" 2>/dev/null || true)
  if [ "$candidate_metadata" != "$candidate_id|/$container|$ownership_token" ]; then
    ownership_unverified=1
    fail "container ownership verification failed: $candidate_id"
  fi
  container_id=$candidate_id
else
  if [ -n "$candidate_id" ]; then
    candidate_metadata=$(docker inspect --format '{{.Id}}|{{.Name}}|{{index .Config.Labels "com.tomodachi.schema-parity.owner"}}' "$candidate_id" 2>/dev/null || true)
    if [ "$candidate_metadata" = "$candidate_id|/$container|$ownership_token" ]; then
      container_id=$candidate_id
      fail 'container creation reported failure after owned resource was created'
    fi
  else
    candidate_metadata=$(docker inspect --format '{{.Id}}|{{.Name}}|{{index .Config.Labels "com.tomodachi.schema-parity.owner"}}' "$container" 2>/dev/null || true)
    discovered_id=${candidate_metadata%%|*}
    if [ -n "$discovered_id" ] &&
      [ "$candidate_metadata" = "$discovered_id|/$container|$ownership_token" ]; then
      candidate_id=$discovered_id
      container_id=$discovered_id
      fail 'container creation reported failure after owned resource was discovered'
    fi
  fi
  ownership_unverified=1
  fail 'container creation failed without verifiable ownership'
fi

attempt=0
until docker exec "$container_id" pg_isready --username tomodachi --dbname tomodachi >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || fail 'PostgreSQL readiness timed out'
  sleep 1
done

docker exec -i "$container_id" psql --username tomodachi --dbname tomodachi \
  --set ON_ERROR_STOP=1 <"$repo/db/init.sql" >"$tmp_dir/init.log"

port_mapping=$(docker port "$container_id" 5432/tcp)
host_port=${port_mapping##*:}
case "$host_port" in
  ''|*[!0-9]*) fail "unexpected Docker port mapping: $port_mapping" ;;
esac

(
  cd "$repo/backend"
  if [ "$backend_launcher" = setsid ]; then
    exec setsid env SPRING_PROFILES_ACTIVE=dev \
      TOMODACHI_DATABASE_URL="jdbc:postgresql://127.0.0.1:$host_port/tomodachi" \
      TOMODACHI_DATABASE_USER=tomodachi TOMODACHI_DATABASE_PASSWORD="$password" \
      SERVER_PORT=0 ./gradlew --no-daemon bootRun
  fi
  exec perl -MPOSIX -e 'defined(POSIX::setsid()) or die $!; exec {$ARGV[0]} @ARGV or die $!' \
    env SPRING_PROFILES_ACTIVE=dev \
    TOMODACHI_DATABASE_URL="jdbc:postgresql://127.0.0.1:$host_port/tomodachi" \
    TOMODACHI_DATABASE_USER=tomodachi TOMODACHI_DATABASE_PASSWORD="$password" \
    SERVER_PORT=0 ./gradlew --no-daemon bootRun
) >"$tmp_dir/backend.log" 2>&1 &
backend_pid=$!
backend_group=$backend_pid
sleep 1
observed_group=$(ps -o pgid= -p "$backend_pid" | tr -d ' ')
[ "$observed_group" = "$backend_group" ] ||
  fail "backend process-group isolation failed: pid=$backend_pid pgid=$observed_group"

attempt=0
until grep -F 'Started TomodachiBackendApplication' "$tmp_dir/backend.log" >/dev/null 2>&1; do
  kill -0 "$backend_pid" >/dev/null 2>&1 || {
    sed -n '1,220p' "$tmp_dir/backend.log" >&2
    fail 'backend exited before JPA schema validation completed'
  }
  attempt=$((attempt + 1))
  [ "$attempt" -lt 120 ] || fail 'backend startup timed out'
  sleep 1
done

catalog_sql="SELECT jsonb_build_object(
  'tables', COALESCE((SELECT jsonb_agg(c.relname ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'), '[]'::jsonb),
  'checks', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'table', t.relname,
      'name', con.conname,
      'definition', pg_get_constraintdef(con.oid, true))
    ORDER BY t.relname, con.conname)
    FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'c'), '[]'::jsonb),
  'foreignKeys', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'table', t.relname,
      'name', con.conname,
      'columns', to_jsonb(ARRAY(SELECT a.attname
        FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        ORDER BY k.ord)),
      'foreignTable', ft.relname,
      'foreignColumns', to_jsonb(ARRAY(SELECT fa.attname
        FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute fa ON fa.attrelid = ft.oid AND fa.attnum = k.attnum
        ORDER BY k.ord)),
      'onDelete', CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE con.confdeltype::text
      END)
    ORDER BY t.relname, con.conname)
    FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_class ft ON ft.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'f'), '[]'::jsonb),
  'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'table', t.relname,
      'name', x.relname,
      'unique', i.indisunique,
      'primary', i.indisprimary,
      'columns', to_jsonb(ARRAY(SELECT a.attname
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        WHERE k.attnum > 0 ORDER BY k.ord)))
    ORDER BY t.relname, x.relname)
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_class x ON x.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'), '[]'::jsonb));"
docker exec "$container_id" psql --username tomodachi --dbname tomodachi \
  --tuples-only --no-align --command "$catalog_sql" >"$tmp_dir/actual.json"

jq --sort-keys . "$tmp_dir/fixture.snapshot.json" >"$tmp_dir/expected.normalized.json"
jq --sort-keys . "$tmp_dir/actual.json" >"$tmp_dir/actual.normalized.json"
if ! cmp -s "$tmp_dir/expected.normalized.json" "$tmp_dir/actual.normalized.json"; then
  jq -r --slurpfile actual "$tmp_dir/actual.normalized.json" '
    (.indexes - $actual[0].indexes)[] |
    "\(.table) index mismatch: missing actual \(.name)"' "$tmp_dir/expected.normalized.json" >&2
  jq -r --slurpfile actual "$tmp_dir/actual.normalized.json" '
    ($actual[0].indexes - .indexes)[] |
    "\(.table) index mismatch: unexpected actual \(.name)"' "$tmp_dir/expected.normalized.json" >&2
  jq -r --slurpfile actual "$tmp_dir/actual.normalized.json" '
    (.foreignKeys - $actual[0].foreignKeys)[] |
    "\(.table) foreign key mismatch: missing actual \(.name)"' "$tmp_dir/expected.normalized.json" >&2
  jq -r --slurpfile actual "$tmp_dir/actual.normalized.json" '
    ($actual[0].foreignKeys - .foreignKeys)[] |
    "\(.table) foreign key mismatch: unexpected actual \(.name)"' "$tmp_dir/expected.normalized.json" >&2
  jq -r --slurpfile actual "$tmp_dir/actual.normalized.json" '
    (.checks - $actual[0].checks)[] |
    "\(.table) check mismatch: missing actual \(.name)"' "$tmp_dir/expected.normalized.json" >&2
  jq -r --slurpfile actual "$tmp_dir/actual.normalized.json" '
    ($actual[0].checks - .checks)[] |
    "\(.table) check mismatch: unexpected actual \(.name)"' "$tmp_dir/expected.normalized.json" >&2
  diff -u "$tmp_dir/expected.normalized.json" "$tmp_dir/actual.normalized.json" >&2 || true
  fail 'catalog mismatch'
fi

printf '%s\n' 'schema-parity: PASS db/init.sql + JPA validate + pg_catalog fixture'
