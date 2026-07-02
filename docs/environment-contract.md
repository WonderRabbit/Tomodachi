# Tomodachi environment contract

**작성 기준일:** 2026-06-29 KST
**범위:** `local`, `dev`, `prod` 환경의 현재 동작, 필요한 build tools, env template 사용 규칙

이 문서는 Tomodachi를 어디에서 어떻게 실행할지 정하는 repo-facing 계약이다. 현재 저장소의 backend runtime 계약은 profile을 비운 기본/local H2 경로, 공유 검증용 `dev`, 실제 운영용 `prod`로 나눈다. 기본값은 H2 memory DB 편의성을 유지하고, `dev`/`prod`는 PostgreSQL schema validate 경로로 운영한다.

## 환경 요약

| 환경 | 목적 | 현재 backend runtime | Database | Frontend | 공개 범위 |
| --- | --- | --- | --- | --- | --- |
| `local` | 개인 개발, 빠른 기능 검증 | 기본값. `SPRING_PROFILES_ACTIVE`를 비우면 H2 memory DB를 쓴다. | 기본 H2 memory. Docker 경로를 선택하면 PostgreSQL container. | Vite dev server 또는 Docker nginx. | `127.0.0.1` local only |
| `dev` | 공유 검증, 배포 rehearsal | `SPRING_PROFILES_ACTIVE=dev`를 사용한다. | PostgreSQL. `db/init.sql` 적용 후 schema validate. | 빌드된 정적 asset 또는 image. | 제한된 팀/테스트 도메인 |
| `prod` | 실제 운영 | `SPRING_PROFILES_ACTIVE=prod`를 사용한다. | PostgreSQL. destructive schema 변경 금지. | 빌드된 정적 asset 또는 image. | TLS가 붙은 운영 도메인 |

중요한 현재 상태:

- `backend/src/main/resources/application.yml` 기본값은 `jdbc:h2:mem:tomodachi;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1`이다.
- 기본값은 `spring.jpa.hibernate.ddl-auto=update`이므로 `local` 편의성에 맞춘 설정이다.
- `dev` profile은 PostgreSQL 연결값을 env로 받고 `spring.jpa.hibernate.ddl-auto=validate`를 사용한다. env가 비어 있으면 local rehearsal 기본값 `jdbc:postgresql://localhost:5432/tomodachi_dev`를 쓴다.
- `prod` profile은 PostgreSQL 연결값을 env로 받아야 하며 `spring.jpa.hibernate.ddl-auto=validate`를 사용한다.
- 로컬 Docker/Compose PostgreSQL 경로도 현재 계약에서는 `SPRING_PROFILES_ACTIVE=dev`를 사용한다.
- `db/init.sql`은 standalone schema mirror다. Docker Compose의 PostgreSQL empty volume에서는 최초 1회만 자동 적용된다.

## 필수 build tools

| 영역 | 필수 도구 | local | dev/prod |
| --- | --- | --- | --- |
| Backend | Java 21, Gradle wrapper, Kotlin 2.2.21, Spring Boot 3.5.9 | `cd backend && ./gradlew test` 또는 Windows `.\gradlew.bat test` | image build 또는 `bootJar` build 전에 동일하게 필요 |
| Frontend | Node.js LTS, npm, TypeScript, Vite, React 19 | `cd front && npm run typecheck`, `npm run build`, 필요 시 `npm run dev` | `npm run build` 결과를 nginx/static server/image로 배포 |
| Visual QA | Playwright | `cd front && npm run visual:qa` | release 전 smoke/visual QA에 사용 |
| Database | PostgreSQL client/server, `psql`, `db/init.sql` | H2 기본값은 PostgreSQL 불필요. PostgreSQL rehearsal에는 필요 | 필수. schema 적용/검증/backup/restore에 필요 |
| Deployment | Docker/Compose, SSH tooling, GitHub Actions | macOS zsh Docker 경로에서 필요. Windows native 경로에서는 Docker 불필요 | VM Compose 배포에서는 필요. cloud-native 배포는 provider CLI/OIDC 사용 |

## `local` 계약

### 기본 backend H2 경로

backend만 빠르게 검증할 때는 외부 PostgreSQL이 필요 없다.

```zsh
cd backend
./gradlew test
./gradlew bootRun
```

Windows 10 PowerShell 7.6 native에서도 같은 의미로 실행한다.

```powershell
cd backend
.\gradlew.bat test
.\gradlew.bat bootRun
```

이 경로는 H2 memory DB가 기본이다. 앱을 재시작하면 데이터가 유지되지 않는다. H2 기본값을 숨기거나 PostgreSQL 필수처럼 문서화하지 않는다.

### macOS zsh Docker path

macOS zsh에서는 Docker Desktop/Compose 사용을 허용한다. 로컬 compose는 기본적으로 host port를 `127.0.0.1`에만 bind한다.

```zsh
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/docker-compose.yml --project-directory . config
docker compose --env-file deploy/.env -f deploy/docker-compose.yml --project-directory . up --build
```

`deploy/env.local.template`은 로컬 값 설명용 template이다. 실제 secret 또는 local override는 `deploy/.env`에 둔다.

### Windows 10 PowerShell 7.6 native path

Windows 10 PowerShell 7.6 native 경로는 `winget`과 Docker에 의존하지 않는다. 설치 파일은 공식 배포 페이지에서 수동으로 내려받고, 명령은 이미 설치된 binary를 검증하는 데 사용한다.

필수 항목:

- PowerShell 7.6
- Java 21 JDK
- Node.js LTS와 npm
- PostgreSQL server/client는 PostgreSQL rehearsal 또는 Docker/Compose local 실행에만 필요

검증 명령:

```powershell
pwsh -NoLogo -Command '$PSVersionTable.PSVersion'
java -version
node -v
npm -v
psql --version
```

backend H2 경로만 쓰면 PostgreSQL은 생략할 수 있다. PostgreSQL rehearsal을 선택하면 `db/init.sql`을 `psql`로 적용하고 `SPRING_PROFILES_ACTIVE=dev`와 database env를 현재 process 또는 사용자별 env 파일에 주입한다.

## `dev` 계약

`dev`는 공유 검증 환경이다. backend의 `dev` profile을 사용해 운영 이름과 Spring runtime profile을 일치시킨다.

```text
TOMODACHI_ENV=dev
SPRING_PROFILES_ACTIVE=dev
```

필수 규칙:

- Database는 PostgreSQL을 사용한다.
- `db/init.sql`을 적용한 뒤 backend는 `spring.jpa.hibernate.ddl-auto=validate`로 시작한다.
- 공유 `dev`에서는 `TOMODACHI_DATABASE_URL`, `TOMODACHI_DATABASE_USER`, `TOMODACHI_DATABASE_PASSWORD`를 환경별 secret/env로 주입한다.
- 운영 데이터 또는 운영 secret을 재사용하지 않는다.
- cloud 비용을 낮추기 위해 작은 단일 VM + Docker Compose를 기본 rehearsal 경로로 둔다.
- public bind, domain, TLS, backup 정책은 dev owner가 명시적으로 승인한 뒤 켠다.

Template: `deploy/env.dev.template`

## `prod` 계약

`prod`는 실제 운영 환경이다. backend의 `prod` profile을 사용해 운영 이름과 Spring runtime profile을 일치시킨다.

```text
TOMODACHI_ENV=prod
SPRING_PROFILES_ACTIVE=prod
```

필수 규칙:

- Database는 PostgreSQL을 사용한다.
- `db/init.sql` 또는 승인된 migration 절차가 먼저 적용되어 있어야 한다.
- backend는 `spring.jpa.hibernate.ddl-auto=validate`로 시작한다.
- `ddl-auto=update` 같은 destructive 또는 implicit schema 변경 경로를 prod 절차로 쓰지 않는다.
- secret은 GitHub Environment secret, cloud secret manager, OS-level secret store 중 하나에 둔다.
- TLS, DNS ownership, SSH key owner, backup/restore drill, budget alert를 배포 전 확인한다.
- cloud account ID, API key, SSH private key, prod password를 repo 파일에 쓰지 않는다.

Template: `deploy/env.prod.template`

## Env variable contract

| 변수 | local H2 | local Docker | dev | prod |
| --- | --- | --- | --- | --- |
| `TOMODACHI_ENV` | 선택. 비워도 됨 | `local` | `dev` | `prod` |
| `SPRING_PROFILES_ACTIVE` | 비움 | `dev` | `dev` | `prod` |
| `TOMODACHI_DATABASE_URL` | 비움 | `jdbc:postgresql://db:5432/tomodachi` | secret/env에서 주입 | secret/env에서 주입 |
| `TOMODACHI_DATABASE_USER` | 비움 | `tomodachi` | secret/env에서 주입 | secret/env에서 주입 |
| `TOMODACHI_DATABASE_PASSWORD` | 비움 | local-only 값 | secret manager에서 주입 | secret manager에서 주입 |
| `POSTGRES_DB` | 해당 없음 | `tomodachi` | provider/VM 값 | provider/VM 값 |
| `POSTGRES_USER` | 해당 없음 | `tomodachi` | provider/VM 값 | provider/VM 값 |
| `POSTGRES_PASSWORD` | 해당 없음 | local-only 값 | secret manager에서 주입 | secret manager에서 주입 |

`TOMODACHI_DATABASE_PASSWORD`와 `POSTGRES_PASSWORD`는 template에 실제 값을 쓰지 않는다. 로컬 예제값은 local-only이고 운영 credential로 재사용하지 않는다.

## Promotion gate

`local`에서 `dev`로 올리기 전:

```zsh
git diff --check
cd backend && ./gradlew test
cd front && npm run typecheck
cd front && npm run build
docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml --project-directory . config
```

`dev`에서 `prod`로 올리기 전:

- dev 배포의 backend health와 frontend route가 관측되어야 한다.
- PostgreSQL backup/restore 절차가 문서화되어 있어야 한다.
- DNS, TLS, SSH owner, budget alert, secret rotation owner가 확인되어야 한다.
- GitHub Actions를 사용할 경우 prod는 GitHub Environment approval 뒤에만 실행한다.
