# Tomodachi 환경 분리 및 CI/CD 계획

**작성일:** 2026-06-29
**상태:** 승인 후 계획 확정
**권장안:** AWS-first GitHub Actions + GHCR + SSH/Compose

## 1. 결론

Tomodachi는 `local`, `dev`, `prod` 3개 환경으로 나누는 것이 맞다.

- `local`: 개인 개발용이다. macOS zsh는 Docker/Compose를 써도 되고, Windows 10 PowerShell은 Docker와 `winget` 없이 native 실행 경로를 유지한다.
- `dev`: 실제 클라우드에 올리는 검증 환경이다. 비용을 낮추기 위해 AWS 또는 GCP의 작은 VM 1대와 Docker Compose를 기본으로 둔다.
- `prod`: 운영 환경이다. 초기에는 dev와 같은 구조를 쓰되, 도메인, TLS, 백업, 예산 알림, 수동 승인 gate를 반드시 추가한다.

현재 운영자에게 가장 맞는 CI/CD는 **1안: GitHub Actions + GHCR + SSH/Compose**다. 이유는 단순하다. 지금 저장소에는 Dockerfile/Compose, dev/prod Compose overlay, GHCR image publish, dev/prod deploy workflow가 준비되어 있고, managed cloud로 바로 가면 비용과 권한 설계가 먼저 커진다. CI/CD 선택지의 상세 비교와 운영자 적합도 판정은 `docs/ci-cd-options.md`를 기준으로 한다.

## 2. 현재 저장소 근거

### Backend

- `backend/build.gradle.kts`는 Kotlin `2.2.21`, Spring Boot `3.5.9`, Java 21 toolchain을 사용한다.
- PostgreSQL driver와 H2 runtime이 모두 있다.
- `application.yml` 기본값은 H2이고, `dev`/`prod` profile은 `ddl-auto: validate`를 사용한다.
- `application.yml`에는 `dev`, `prod` profile 구간이 있고, 두 profile 모두 PostgreSQL driver와 `ddl-auto: validate`를 사용한다.

### Frontend

- `front/package.json`은 Vite, React 19, TypeScript, Playwright를 사용한다.
- 주요 검증 명령은 `npm run typecheck`, `npm run build`, `npm run visual:qa`다.
- `front/env/local.example`, `front/env/dev.example`, `front/env/prod.example`와 `src/config/appConfig.ts`가 환경별 API base URL 경계를 typed config로 분리한다.
- MVP mock-data boundary는 유지해야 한다.

### Deploy

- `deploy/docker-compose.yml`은 Postgres 17, backend, frontend를 함께 띄운다.
- 현재 포트는 `127.0.0.1`에 묶여 있어 local 전용 성격이 강하다.
- `deploy/docker-compose.dev.yml`, `deploy/docker-compose.prod.yml`은 VM 배포용 overlay로 GHCR image, `dev`/`prod` profile, Caddy TLS, backup profile을 분리한다.

### CI

- `.github/workflows/deploy-qa.yml`은 Linux Docker live deploy QA와 Windows PowerShell wrapper 검증을 한다.
- `.github/workflows/ci.yml`, `image-publish.yml`, `deploy-dev.yml`, `deploy-prod.yml`이 일반 CI, GHCR image publish, dev deploy, prod approval deploy를 담당한다.
- GitHub Environment `prod` raw API `protection_rules`에는 required reviewer `WonderRabbit`가 표시된다. jq로 `.reviewers`만 조회하면 `null`일 수 있으므로 이 필드만으로 승인 규칙 부재를 판단하지 않는다. 현재 live setting은 `can_admins_bypass: false`이고 `deployment_branch_policy: null`이다. environment branch policy가 없으므로 workflow의 `main`/`v*` branch guard를 유지해야 한다.

## 3. 환경 설계

### 3.1 local

macOS zsh:

- Docker Desktop 또는 Docker Engine + Compose 사용 가능.
- 기본 실행은 기존 `scripts/deploy.sh`와 `deploy/docker-compose.yml`을 유지한다.
- DB는 Compose의 Postgres 또는 H2 local profile을 쓸 수 있다.
- 검증 명령:

```bash
cd backend && ./gradlew test
cd front && npm run typecheck
cd front && npm run build
docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml --project-directory . config
```

Windows 10 PowerShell:

- `winget`과 Docker를 전제하지 않는다.
- 필요한 도구는 수동 설치 문서로 관리한다.
- 필수 도구:
  - PowerShell 7.6+
  - Java 21
  - Node.js/npm
  - PostgreSQL server/client 또는 외부 PostgreSQL
  - Git
- 실행은 `java -jar` backend와 Vite frontend preview/dev server를 native로 분리한다.

### 3.2 dev

목적:

- prod 전에 실제 클라우드 네트워크, DB, 이미지, secret, domain/TLS를 검증한다.
- 비용을 낮추기 위해 작은 VM 1대를 기본값으로 둔다.

AWS 기본:

- Lightsail 또는 작은 EC2 인스턴스 1대
- Docker/Compose
- GHCR image pull
- Route 53은 도메인을 AWS에서 관리할 때만 사용
- AWS Budgets 필수
- Parameter Store 또는 GitHub Environment Secret으로 secret 관리

GCP 대안:

- Compute Engine e2 계열 작은 VM 1대
- Docker/Compose
- GHCR image pull
- Cloud DNS는 도메인을 GCP에서 관리할 때만 사용
- Cloud Billing budget 필수
- Secret Manager 또는 GitHub Environment Secret으로 secret 관리

### 3.3 prod

prod는 dev와 같은 구조에서 시작하되 아래 조건을 더 강하게 둔다.

- GitHub Environment `prod` raw API `protection_rules`의 required reviewer `WonderRabbit` 승인. 현재 `can_admins_bypass: false`다.
- prod branch/tag guard
- 도메인 DNS record 명시
- TLS 인증서 자동 갱신
- DB backup/restore 절차
- SSH 접속자 제한
- budget alert
- secret rotation 절차
- 장애 시 rollback 명령

초기에는 single VM + Compose가 맞다. 트래픽, SLA, 장애 대응 요구가 커진 뒤에 RDS/Cloud SQL, ECS/Cloud Run 같은 managed 구조로 옮긴다.

## 4. 필요한 빌드 도구

| 영역 | 도구 | local macOS | local Windows 10 | dev/prod |
| --- | --- | --- | --- | --- |
| Backend | Java 21 | 필요 | 필요 | image build runner에 필요 |
| Backend | Gradle wrapper | 필요 | 필요 | CI에 필요 |
| Backend | Kotlin/Spring Boot | wrapper로 고정 | wrapper로 고정 | CI에서 검증 |
| Frontend | Node.js/npm | 필요 | 필요 | CI에 필요 |
| Frontend | TypeScript/Vite | npm dependency | npm dependency | CI에서 검증 |
| DB | PostgreSQL | Docker 또는 native | native 권장 | VM/managed DB |
| DB | `psql` | 있으면 좋음 | 필요 | backup/restore에 필요 |
| Deploy | Docker/Compose | 허용 | native 경로에서는 금지 | 기본 필요 |
| CI/CD | GitHub Actions | 원격 | 원격 | 기본 |
| Registry | GHCR | pull 테스트 | pull 테스트 | 기본 |
| Security | SSH | 선택 | 선택 | 필수 |
| Cloud | AWS CLI/GCloud CLI | 선택 | 선택 | cloud-native/OIDC 설정 시 필요 |

## 5. CI/CD 3안

상세 matrix와 prod branch guard/approval 경고는 `docs/ci-cd-options.md`에 둔다. 이 절은 실행 계획에서 필요한 요약만 유지한다.

### 1안. GitHub Actions + GHCR + SSH/Compose

구조:

1. Pull request 또는 push에서 backend/frontend CI 실행
2. `main` 또는 tag에서 backend/frontend Docker image build
3. GHCR에 image push
4. `dev` GitHub Environment로 SSH deploy
5. `prod` GitHub Environment는 raw API `protection_rules`에 표시되는 required reviewer `WonderRabbit` 승인 후 SSH deploy. 현재 `can_admins_bypass: false`다.

장점:

- 현재 저장소 구조와 가장 잘 맞는다.
- VM 1대 기준으로 비용이 낮다.
- AWS와 GCP를 거의 같은 방식으로 운영할 수 있다.
- GHCR를 쓰면 AWS ECR/GCP Artifact Registry부터 만들 필요가 없다.

단점:

- VM patching, Docker update, disk/backup 관리는 직접 해야 한다.
- SSH key 운영을 신중히 해야 한다.

권장 여부: **현재 기본 추천안**. prod는 GitHub Environment `prod` raw API `protection_rules`의 required reviewer `WonderRabbit`, `workflow_dispatch`, `main`/`v*` tag guard를 함께 요구한다. 현재 `prod` Environment는 `can_admins_bypass: false`와 `deployment_branch_policy: null`로 확인되었으므로, Environment branch policy만으로 보호한다고 가정하지 않고 workflow branch guard를 유지한다.

### 2안. GitHub Actions + cloud-native managed deploy

AWS:

- ECR
- ECS/Fargate 또는 EC2 ASG
- RDS PostgreSQL
- Route 53/ACM
- Parameter Store/Secrets Manager
- GitHub OIDC

GCP:

- Artifact Registry
- Cloud Run 또는 GKE/Compute Engine
- Cloud SQL PostgreSQL
- Cloud DNS/Certificate Manager
- Secret Manager
- GitHub OIDC

장점:

- 장기 운영, 확장, 장애 대응이 좋아진다.
- SSH 의존도를 줄일 수 있다.
- OIDC를 쓰면 장기 cloud key를 줄일 수 있다.

단점:

- 초기 설계가 크다.
- managed DB와 network 비용이 dev 단계에서 부담될 수 있다.
- IAM, VPC, service account 설계가 필요하다.

권장 여부: MVP 이후, 운영 트래픽과 SLA가 생길 때 전환 후보. 특히 단일 VM 장애 시간이 허용되지 않거나, managed PostgreSQL backup/PITR, zero-downtime deploy, OIDC 기반 cloud 권한 분리가 필요해질 때 검토한다.

### 3안. Jenkins/self-hosted pipeline

구조:

- Jenkins controller/agent 운영
- multibranch pipeline
- backend/frontend build
- image publish
- SSH 또는 cloud deploy

장점:

- 내부망, 사내 runner, self-hosted 요구가 있을 때 제어권이 크다.
- `WonderRabbit/jang-agent-potal`의 Jenkins 문서를 참고할 수 있다.

단점:

- Jenkins 운영 자체가 별도 일이 된다.
- plugin/security update 부담이 크다.
- branch guard가 약하면 feature branch가 prod로 배포되는 사고가 날 수 있다.

권장 여부: 지금은 비추천. GitHub Actions로 부족해진 뒤 검토한다. Jenkins를 쓰더라도 feature branch가 prod로 배포되지 않도록 `when { branch 'main' }` 같은 branch guard와 수동 prod approval을 먼저 설계해야 한다.

## 6. 비용 원칙

AWS/GCP 가격은 지역, 스토리지, 백업, 트래픽, 고정 IP, 로그 보관에 따라 달라진다. 그래서 계획에서는 월액을 하드코딩하지 않는다. 대신 아래 gate를 둔다.

- 상세 비용/보안 runbook은 `docs/cloud-cost-security-runbook.md`를 기준으로 한다.
- dev는 가장 작은 VM + Docker Compose로 시작한다.
- prod도 초기에는 작은 VM + Compose로 시작하되 backup과 monitoring 비용을 포함한다.
- managed DB는 편하지만 dev부터 쓰면 고정비가 커질 수 있다.
- static IP, 외부 IPv4, DNS hosted zone, snapshot, egress 비용을 별도로 확인한다.
- AWS Budgets 또는 GCP Billing budget을 배포 전 필수 조건으로 둔다.

공식 가격 확인 위치:

- AWS Lightsail pricing: https://aws.amazon.com/lightsail/pricing/
- AWS EC2 On-Demand pricing: https://aws.amazon.com/ec2/pricing/on-demand/
- AWS RDS for PostgreSQL pricing: https://aws.amazon.com/rds/postgresql/pricing/
- AWS ECS pricing: https://aws.amazon.com/ecs/pricing/
- GCP Compute Engine pricing: https://cloud.google.com/compute/vm-instance-pricing
- GCP Cloud Run pricing: https://cloud.google.com/run/pricing
- GCP Cloud SQL pricing: https://cloud.google.com/sql/pricing

## 7. 보안/운영 항목

도메인:

- 구매처, DNS provider, renewal email을 문서화한다.
- `dev.example.com`, `app.example.com`처럼 dev/prod를 분리한다.
- Route 53 또는 Cloud DNS를 쓰면 hosted zone 비용도 확인한다.

SSH:

- 개인 private key를 repo에 두지 않는다.
- GitHub Actions deploy key는 환경별로 분리한다.
- 서버의 `authorized_keys`는 최소 권한으로 관리한다.
- SSH 접속 user는 deploy 전용 user로 제한한다.

API key/secret:

- GitHub Environment Secret을 기본 저장소로 쓴다.
- AWS/GCP managed path에서는 OIDC를 우선 검토한다.
- `.env` 예시는 placeholder만 둔다.
- secret rotation 날짜를 runbook에 적는다.

TLS:

- dev/prod 모두 HTTPS를 원칙으로 한다.
- single VM이면 Caddy 또는 nginx + certbot 중 하나로 통일한다.
- 인증서 갱신 실패 알림을 둔다.

DB:

- backup 명령과 restore rehearsal을 문서화한다.
- prod 배포 전 `pg_dump` 또는 snapshot 정책을 확인한다.
- DB password는 GitHub Secret 또는 cloud secret manager에 둔다.

## 8. 구현 완료 흐름

1. 환경 계약 문서와 env template을 작성했다.
2. backend `dev`/`prod` profile을 `application.yml`에 분리했다.
3. frontend API base URL env boundary를 `front/env/*.example`과 typed config로 추가했다.
4. dev/prod Compose overlay를 `deploy/docker-compose.dev.yml`, `deploy/docker-compose.prod.yml`로 추가했다.
5. AWS/GCP 비용/보안 runbook을 정리했다.
6. GitHub Actions CI를 `.github/workflows/ci.yml`로 분리했다.
7. GHCR image publish workflow를 `.github/workflows/image-publish.yml`로 추가했다.
8. dev deploy workflow를 `.github/workflows/deploy-dev.yml`로 추가했다.
9. prod required reviewer deploy workflow를 `.github/workflows/deploy-prod.yml`로 추가했다.
10. 전체 검증 evidence를 Todo별 `.omo/evidence`에 기록한다.

## 9. 검증 명령

```bash
git diff --check
cd backend && ./gradlew test
cd front && npm run typecheck
cd front && npm run build
docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml --project-directory . config
```

workflow YAML을 추가하면 모든 workflow 파일을 YAML parser로 검증한다.

```bash
ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f); puts f }' .github/workflows/*.yml
```

## 10. 완료 기준

- `local`, `dev`, `prod`가 문서와 config에서 명확히 분리된다.
- macOS zsh와 Windows 10 PowerShell native 경로가 모두 유지된다.
- AWS/GCP dev/prod 트랙이 비용/보안 항목과 함께 문서화된다.
- CI/CD 3안과 추천안이 문서화된다.
- 추천안은 GitHub Actions + GHCR + SSH/Compose다.
- `docs/ci-cd-options.md`가 1안/2안/3안 matrix, 1안 추천 이유, 2안 전환 조건, Jenkins 비추천 사유, prod approval/branch guard 경고를 담는다.
- backend/frontend/build/compose 검증 명령이 통과한다.
- secret, private key, cloud key가 repo에 들어가지 않는다.
- prod 배포는 GitHub Environment `prod` raw API `protection_rules`의 required reviewer `WonderRabbit`, `workflow_dispatch`, `main`/`v*` tag guard, `confirm_prod=deploy-prod` 입력을 함께 요구한다. 현재 `can_admins_bypass: false`이고 `deployment_branch_policy: null`이므로, 우회 없는 승인 gate와 workflow branch guard를 모두 완료 조건으로 유지한다.
