# Tomodachi one-command 배포 가이드

이 문서는 Windows PowerShell 7.6과 macOS zsh에서 같은 배포 구조를 사용해 Tomodachi MVP, PostgreSQL 데이터베이스, 백엔드, 프런트를 한 번에 올리는 절차다. 기본 개발 모드의 H2 설정은 유지하고, 배포 명령만 Docker Compose와 PostgreSQL을 사용한다.

> 네 가지 운영 경로별 상세 runbook은 [deployment-step-by-step.md](./deployment-step-by-step.md)를 먼저 본다. 특히 `winget`과 Docker를 사용할 수 없는 Windows PowerShell 환경은 이 문서의 `scripts/deploy.ps1` 경로가 아니라 native PostgreSQL/JDK/Node 설치 경로를 사용해야 한다.

## 결론

| 환경 | 한 번 명령 | 결과 |
| --- | --- | --- |
| Windows PowerShell 7.6 | `pwsh -File .\scripts\deploy.ps1 up` | PostgreSQL, Spring Boot backend, nginx frontend를 `tomodachi` Compose project로 빌드/기동한다. |
| macOS zsh | `./scripts/deploy.sh up` | 동일한 Compose project를 빌드/기동하고 backend health를 기다린다. |

기동 후 기본 URL은 다음과 같다.

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:8080/actuator/health`
- PostgreSQL host port: `127.0.0.1:5432`

## 설계 근거

- Docker Compose는 `-f`로 compose 파일 경로를 지정하고 `-p` 또는 project name으로 project를 고정할 수 있다. 이 저장소는 `deploy/docker-compose.yml`의 `name`과 `deploy/.env.example`의 `COMPOSE_PROJECT_NAME=tomodachi`를 함께 둔다.
- Compose는 컨테이너가 실행 중인지와 준비 완료인지를 구분한다. PostgreSQL은 `pg_isready` healthcheck를 두고 backend는 `depends_on.db.condition: service_healthy`로 database 준비 후 시작한다.
- 공식 PostgreSQL image는 `/docker-entrypoint-initdb.d` 아래의 `*.sql`을 빈 data directory에서만 실행한다. `db/init.sql`은 이 경로에 read-only로 mount되며, 이미 만들어진 volume에는 다시 적용되지 않는다.
- PowerShell 7은 Windows PowerShell 5.1을 대체하지 않고 side-by-side로 설치된다. Windows client에서는 `winget` 설치가 권장 경로이며, 이 문서는 PowerShell 7.6 이상에서 실행되는 `scripts/deploy.ps1`을 기준으로 한다.

## 1. 사전 준비

Windows:

```powershell
winget install --id Microsoft.PowerShell --source winget --installer-type wix
winget install --id Docker.DockerDesktop --source winget
```

설치 후 Windows Terminal에서 `PowerShell 7` 탭을 열고 버전을 확인한다.

```powershell
$PSVersionTable.PSVersion
docker compose version
```

macOS:

```zsh
brew install --cask docker
zsh --version
docker compose version
```

Docker Desktop을 실행한 뒤 아래 명령이 성공해야 한다.

```zsh
docker info
```

## 2. 환경값 확인

기본값은 `deploy/.env.example`에 있다.

```text
COMPOSE_PROJECT_NAME=tomodachi
POSTGRES_DB=tomodachi
POSTGRES_USER=tomodachi
POSTGRES_PASSWORD=tomodachi_local_password
POSTGRES_PORT=5432
TOMODACHI_BACKEND_PORT=8080
TOMODACHI_FRONTEND_PORT=5173
```

로컬 비밀번호나 포트를 바꾸려면 `deploy/.env`를 만들고 필요한 값만 수정한다. `.env` 파일은 git에 올라가지 않는다.

```zsh
cp deploy/.env.example deploy/.env
```

다른 위치의 env 파일을 쓰려면 두 shell 모두 `TOMODACHI_DEPLOY_ENV`를 지정한다.

```zsh
TOMODACHI_DEPLOY_ENV=/secure/tomodachi.env ./scripts/deploy.sh up
```

```powershell
$env:TOMODACHI_DEPLOY_ENV="C:\secure\tomodachi.env"
pwsh -File .\scripts\deploy.ps1 up
```

## 3. 사전 진단

Windows:

```powershell
pwsh -File .\scripts\deploy.ps1 doctor
```

macOS:

```zsh
./scripts/deploy.sh doctor
```

`docker-daemon: not running`이면 Docker Desktop을 실행하고 다시 시도한다. `doctor`는 설치 상태를 확인하는 명령이고, 실제 배포는 `up`에서 수행한다.

## 4. 한 번에 배포

Windows:

```powershell
pwsh -File .\scripts\deploy.ps1 up
```

macOS:

```zsh
./scripts/deploy.sh up
```

이 명령은 다음 순서로 동작한다.

1. Docker CLI와 Compose plugin을 확인한다.
2. `deploy/docker-compose.yml`을 읽고 `deploy/.env` 또는 `deploy/.env.example` 값을 적용한다.
3. PostgreSQL container를 만들고 `db/init.sql`을 `/docker-entrypoint-initdb.d/001-init.sql`로 mount한다.
4. PostgreSQL healthcheck가 `healthy`가 될 때까지 backend 시작을 기다린다.
5. backend image를 빌드하고 `SPRING_PROFILES_ACTIVE=dev`로 실행한다.
6. frontend image를 빌드하고 nginx로 정적 파일을 serving한다.
7. `http://127.0.0.1:8080/actuator/health`가 응답할 때까지 기다린 뒤 frontend URL을 출력한다.

## 5. 상태 확인

Windows:

```powershell
pwsh -File .\scripts\deploy.ps1 status
pwsh -File .\scripts\deploy.ps1 logs
```

macOS:

```zsh
./scripts/deploy.sh status
./scripts/deploy.sh logs
```

API login smoke check:

```zsh
curl -i -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tomodachi.local","password":"password"}'
```

## 6. 중지와 재시작

서비스만 내리고 database volume은 보존한다.

```zsh
./scripts/deploy.sh down
```

```powershell
pwsh -File .\scripts\deploy.ps1 down
```

같은 database로 다시 올린다.

```zsh
./scripts/deploy.sh up
```

## 7. 데이터베이스 초기화

`db/init.sql`은 PostgreSQL data directory가 비어 있을 때만 실행된다. schema를 처음부터 다시 적용하려면 volume을 삭제해야 한다.

macOS:

```zsh
./scripts/deploy.sh reset-db
```

Windows:

```powershell
pwsh -File .\scripts\deploy.ps1 reset-db
```

이 명령은 `docker compose down -v`로 `tomodachi-postgres-data` volume을 삭제한 뒤 다시 `up`을 수행한다. 기존 local database 내용은 사라진다.

## 8. Compose 설정만 검증

Docker daemon이 꺼져 있어도 Compose file 렌더링은 확인할 수 있다.

```zsh
./scripts/deploy.sh config
```

```powershell
pwsh -File .\scripts\deploy.ps1 config
```

## 9. 파일 역할

| 파일 | 역할 |
| --- | --- |
| `scripts/deploy.sh` | macOS zsh용 one-command wrapper. |
| `scripts/deploy.ps1` | Windows PowerShell 7.6용 one-command wrapper. |
| `deploy/docker-compose.yml` | PostgreSQL, backend, frontend service 정의. |
| `deploy/.env.example` | 로컬 배포 기본값. |
| `deploy/backend.Dockerfile` | backend bootJar build/runtime image. |
| `deploy/frontend.Dockerfile` | frontend build/nginx runtime image. |
| `deploy/nginx.conf` | React Router용 SPA fallback. |
| `db/init.sql` | PostgreSQL empty volume 최초 schema mirror. |
| `backend/src/main/resources/application.yml` | `dev`/`prod` profile에서 PostgreSQL schema validate 사용. |

## 10. 검증 매트릭스

| 항목 | 로컬 검증 명령 | 현재 검증 결과 | 비고 |
| --- | --- | --- | --- |
| macOS zsh wrapper | `./scripts/deploy.sh doctor`, `./scripts/deploy.sh status`, `./scripts/deploy.sh config` | 통과 | Docker CLI와 Compose는 확인했고, Docker daemon 미기동 상태를 명시적으로 보고한다. |
| malformed command | `./scripts/deploy.sh invalid-command` | 통과 | exit code `2`와 usage 출력 확인. |
| Compose file | `docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml --project-directory . config --quiet` | 통과 | build context와 `db/init.sql` bind mount가 저장소 내부 경로로 렌더링됨. |
| Backend regression | `cd backend && ./gradlew test` | 통과 | H2 test profile과 기존 MockMvc 검증 유지. |
| Frontend regression | `cd front && npm run typecheck` | 통과 | Vite/React TypeScript boundary 유지. |
| Live Docker deploy | `./scripts/deploy.sh up` | 이 호스트에서는 미검증 | Docker Desktop bundle이 열리지 않고 Docker daemon socket이 없어 container start가 불가했다. Docker Desktop이 정상인 Windows/macOS에서 실행해야 한다. |
| Windows PowerShell 7.6 wrapper | `pwsh -File .\scripts\deploy.ps1 doctor` | 이 호스트에서는 미검증 | macOS 작업 환경에 `pwsh`가 없어 Windows/PowerShell 실행은 문서와 source review 기준으로만 준비됨. |
| Database init | PostgreSQL empty volume + `/docker-entrypoint-initdb.d/001-init.sql` | Compose config까지 검증 | 실제 `db/init.sql` 실행은 live Docker deploy 검증에 포함된다. |
| Remote live QA | `.github/workflows/deploy-qa.yml` | GitHub Actions에서 검증 | `ubuntu-24.04`는 `./scripts/deploy.sh up`으로 PostgreSQL/backend/frontend와 schema count를 확인하고, `windows-2025`는 PowerShell 7.6 이상에서 `scripts/deploy.ps1` syntax/config를 확인한다. |

로컬 Docker Desktop이 동작하지 않는 경우에도 `Deploy QA` workflow를 `workflow_dispatch`로 실행하면 원격 runner에서 live deploy 증거를 만들 수 있다.

## 11. 문제 해결

`Docker daemon is not running`

Docker Desktop을 실행한 뒤 `docker info`가 성공하는지 확인한다.

`PowerShell 7.6 or newer is required`

Windows PowerShell 5.1에서 실행 중이다. PowerShell 7을 설치하고 `pwsh`로 다시 실행한다.

`port is already allocated`

`deploy/.env`에서 `TOMODACHI_BACKEND_PORT`, `TOMODACHI_FRONTEND_PORT`, `POSTGRES_PORT` 중 충돌하는 값을 바꾼다.

`relation ... does not exist` 또는 schema drift가 의심됨

로컬 데이터가 보존된 volume에 남아 있을 수 있다. 필요한 데이터가 없으면 `reset-db`로 초기화한다.

## 참고한 공식 문서

- Microsoft Learn: `Install PowerShell 7 on Windows`
- Microsoft Learn: `What's New in PowerShell 7.6`
- Microsoft Learn: `Install PowerShell 7 on macOS`
- Docker Docs: `docker compose` CLI reference
- Docker Docs: `Control startup and shutdown order in Compose`
- Docker Hub Official Image: `postgres`
