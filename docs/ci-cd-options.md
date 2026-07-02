# Tomodachi CI/CD 선택지와 운영자 적합도

**작성일:** 2026-07-02
**권장안:** 1안. GitHub Actions + GHCR + SSH/Compose
**범위:** CI/CD 의사결정 문서. 실제 cloud resource, workflow, product code는 이 문서에서 변경하지 않는다.

## 결론

Tomodachi의 현재 기본값은 **1안: GitHub Actions + GHCR + SSH/Compose**가 맞다. 이미 저장소에는 GitHub Actions workflow, GHCR image publish 흐름, dev/prod Compose overlay, SSH 기반 deploy workflow가 준비되어 있고, GitHub Environment `prod`의 raw API `protection_rules`에는 required reviewer `WonderRabbit` 규칙이 표시된다. 현재 live Environment setting은 `can_admins_bypass: false`이고 `deployment_branch_policy: null`이다.

2안인 AWS/GCP managed service 경로는 장기적으로 더 안정적인 운영 모델이지만, 지금 단계에서는 IAM, VPC, managed DB, registry, service routing, 비용 추적의 설계 부담이 먼저 커진다. 3안인 Jenkins/self-hosted pipeline은 내부망 또는 사내 표준 Jenkins가 강제될 때만 검토한다. Tomodachi의 기본 추천안으로 두지 않는다.

## 현재 근거

- CI: `.github/workflows/ci.yml`은 backend test, frontend typecheck/build, Compose config, image build를 분리한다.
- Image publish: `.github/workflows/image-publish.yml`은 `main`, `v*` tag, release, 수동 실행에서 GHCR로 backend/frontend image를 push한다.
- Dev deploy: `.github/workflows/deploy-dev.yml`은 GitHub Environment `dev`, GHCR image, SSH, Docker Compose를 사용한다.
- Prod deploy: `.github/workflows/deploy-prod.yml`은 `workflow_dispatch` 전용이고, `confirm_prod=deploy-prod` 입력과 `main` 또는 `v*` tag branch guard를 요구한다.
- GitHub Environment: `dev`, `prod` 환경이 있고, `prod` raw API `protection_rules`에는 required reviewer `WonderRabbit` 보호 규칙이 표시된다. jq로 `.reviewers`만 보면 `null`일 수 있으므로 이 필드만으로 승인 규칙 부재를 판단하지 않는다. 현재 `prod`의 `can_admins_bypass`는 `false`이고 `deployment_branch_policy`는 `null`이다. environment 자체의 deployment branch policy가 없으므로 workflow의 branch guard를 유지해야 한다.
- Reference warning: `jang-agent-potal`의 Jenkins multibranch 문서는 branch guard가 없을 때 feature branch push가 운영 deploy로 이어질 수 있는 위험을 보여준다. Tomodachi는 이 패턴을 기본값으로 가져오면 안 된다.

## 비교표

| 기준 | 1안. GitHub Actions + GHCR + SSH/Compose | 2안. Cloud-native AWS/GCP managed services | 3안. Jenkins/self-hosted pipeline |
| --- | --- | --- | --- |
| 현재 추천 | **추천** | 전환 후보 | 비추천, 특수 조건에서만 |
| 배포 단위 | GHCR image + VM Docker Compose | AWS ECS/Fargate 또는 GCP Cloud Run 등 managed runtime | Jenkins job + registry + SSH/cloud deploy |
| Registry | GHCR | AWS ECR 또는 GCP Artifact Registry | Nexus, GHCR, private registry 등 |
| Runtime | AWS Lightsail/EC2 또는 GCP Compute Engine 1대 | ECS/Fargate/RDS/ALB 또는 Cloud Run/Cloud SQL/Load Balancer | 사내 VM, Jenkins agent, self-hosted Docker host |
| Secret 관리 | GitHub Environment Secrets/Vars, SSH key, GHCR token | GitHub OIDC + Secrets Manager/Parameter Store 또는 Secret Manager | Jenkins Credentials + 서버 `.env` |
| Prod 승인 | GitHub Environment `prod` raw API `protection_rules`의 required reviewer `WonderRabbit`. 현재 `can_admins_bypass: false` | GitHub Environment + cloud IAM/change control | Jenkins input step 또는 별도 approval plugin 필요 |
| Branch guard | workflow에서 `main`/`v*` tag 제한 필수 | workflow와 cloud deploy policy 양쪽에서 제한 | multibranch면 `when { branch 'main' }` 같은 guard 필수 |
| 운영 부담 | 낮음. VM patching/backup은 직접 관리 | 중간~높음. cloud 권한/네트워크/비용 설계 필요 | 높음. Jenkins 자체 운영, plugin/security update 필요 |
| 비용 초기값 | 낮음. 작은 VM + disk + DNS/TLS | dev부터 managed DB/runtime을 쓰면 고정비 증가 | Jenkins host와 agent 유지비 추가 |
| 장애 대응 | 단일 VM 한계가 있지만 rollback과 Compose 재기동이 단순 | managed health check, autoscaling, DB backup이 강함 | Jenkins 상태와 deploy host 상태를 함께 봐야 함 |

## 1안. GitHub Actions + GHCR + SSH/Compose

### 흐름

1. Pull request와 push에서 backend/frontend/Compose/image build 검증을 실행한다.
2. `main`, `v*` tag, release, 수동 실행에서 backend/frontend image를 GHCR에 publish한다.
3. `dev`는 successful image publish 또는 수동 dispatch로 SSH/Compose deploy한다.
4. `prod`는 수동 dispatch만 허용하고, GitHub Environment raw API `protection_rules`에 표시되는 required reviewer `WonderRabbit` 승인 후 SSH/Compose deploy한다. 현재 `can_admins_bypass: false` 상태다.

### 왜 지금 최선인가

- 현재 repo 구조와 가장 잘 맞는다. Backend, frontend, Postgres, reverse proxy를 Compose 단위로 묶는 deploy surface가 이미 있다.
- cloud provider를 늦게 고를 수 있다. 같은 GHCR image와 Compose bundle을 AWS EC2/Lightsail 또는 GCP Compute Engine에 배포할 수 있다.
- 운영자가 봐야 할 시스템 수가 적다. GitHub Actions, GHCR, VM, Docker Compose, DNS/TLS만 관리하면 된다.
- 비용이 작게 시작된다. dev/prod 모두 작은 VM에서 시작하고, 실제 트래픽과 장애 대응 요구가 생긴 뒤 managed service로 옮길 수 있다.
- prod 승인 경계가 명확하다. GitHub Environment `prod` raw API `protection_rules`의 required reviewer `WonderRabbit`와 workflow branch guard를 함께 쓴다. 현재 admin bypass는 꺼져 있다.

### 주의점

- SSH private key는 repo에 두지 않고 GitHub Environment Secret에만 둔다.
- `prod` deploy는 `workflow_dispatch` 전용을 유지한다. feature branch push나 일반 `push` trigger로 prod가 움직이면 안 된다.
- environment branch policy가 현재 null이므로, `.github/workflows/deploy-prod.yml`의 `main`/`v*` tag guard를 제거하면 안 된다.
- `prod` Environment의 `can_admins_bypass`는 현재 `false`다. 다만 `deployment_branch_policy`가 `null`이므로 `.github/workflows/deploy-prod.yml`의 branch guard가 prod 배포 범위를 계속 제한해야 한다.
- VM patching, Docker update, disk usage, backup/restore rehearsal은 운영자의 책임이다.

## 2안. Cloud-native AWS/GCP managed services

### AWS 경로

- Registry: ECR
- Runtime: ECS/Fargate 또는 ECS on EC2
- DB: RDS PostgreSQL
- Routing/TLS: ALB, Route 53, ACM
- Secret: Secrets Manager 또는 Parameter Store
- CI 권한: GitHub OIDC 기반 role assumption

### GCP 경로

- Registry: Artifact Registry
- Runtime: Cloud Run 또는 GKE/Compute Engine
- DB: Cloud SQL PostgreSQL
- Routing/TLS: Cloud Load Balancing, Cloud DNS, Certificate Manager
- Secret: Secret Manager
- CI 권한: GitHub OIDC 기반 Workload Identity Federation

### 언제 2안으로 옮길 것인가

아래 조건 중 2개 이상이 실제로 생기면 2안을 migration 후보로 올린다.

- prod uptime 목표가 생겨 단일 VM 장애 시간이 더 이상 허용되지 않는다.
- DB backup, PITR, patching, storage 확장이 수동 운영으로 부담된다.
- CPU/RAM scale-out, zero-downtime deploy, health-based rollback이 필요하다.
- 외부 사용자나 팀 수가 늘어 감사 로그, IAM 분리, secret rotation evidence가 필요하다.
- dev/prod 비용 추적이 안정화되어 managed DB/runtime의 월 고정비를 감당할 수 있다.
- 배포 대상이 AWS 또는 GCP 한쪽으로 명확히 고정된다.

### 전환 순서

1. GHCR image tag와 Compose deploy contract를 유지한 채 cloud target만 설계한다.
2. DB를 먼저 managed PostgreSQL로 옮기고 backup/restore를 검증한다.
3. Backend/frontend runtime을 ECS/Fargate 또는 Cloud Run으로 옮긴다.
4. GitHub Actions 권한을 장기 cloud key가 아니라 OIDC로 전환한다.
5. DNS/TLS/rollback/runbook을 prod 기준으로 다시 검증한다.

## 3안. Jenkins/self-hosted pipeline

### 가능한 구조

- Jenkins controller와 agent를 운영한다.
- Multibranch Pipeline 또는 main 전용 pipeline을 둔다.
- Backend/frontend build, image publish, SSH/Compose deploy 또는 cloud deploy를 Jenkinsfile에서 수행한다.
- Credential은 Jenkins Credentials에 둔다.

### 왜 기본값이 아닌가

- Jenkins 자체가 운영 대상이다. controller backup, plugin update, agent 권한, Docker socket 접근, credential rotation이 모두 추가된다.
- Tomodachi는 현재 GitHub repository와 GitHub Actions surface가 이미 있으므로 Jenkins를 새로 도입할 이득이 작다.
- multibranch pipeline을 잘못 열면 feature branch push가 deploy stage를 실행할 수 있다.
- required reviewer, environment secret, branch guard가 GitHub Actions보다 분산되어 운영자가 확인해야 할 곳이 늘어난다.

### Jenkins를 검토해도 되는 조건

- 회사 표준이 Jenkins이고 별도 GitHub Actions runner 사용이 금지된다.
- 사내망 안에서만 접근 가능한 deploy host나 private registry를 써야 한다.
- 이미 운영 중인 Jenkins controller/agent와 credential rotation 절차가 있다.
- Jenkinsfile에 `when { branch 'main' }` 또는 동등한 branch guard가 있고, feature branch는 test만 수행하도록 분리할 수 있다.
- prod deploy에 수동 approval, 감사 로그, rollback evidence를 남길 수 있다.

## Branch Guard와 Prod 승인 경고

Tomodachi에서 prod deploy는 아래 조건을 동시에 만족해야 한다.

- Trigger: `workflow_dispatch` 전용.
- Ref guard: `refs/heads/main` 또는 `refs/tags/v*`만 허용.
- Human approval: GitHub Environment `prod` raw API `protection_rules`에 표시되는 required reviewer `WonderRabbit` 승인. 현재 `can_admins_bypass: false`다.
- Confirmation: `confirm_prod=deploy-prod` 같은 명시 입력.
- Secret scope: prod SSH key, GHCR token, DB password, domain/TLS 값은 `prod` Environment Secret/Var에서만 읽는다.

아래 상태는 배포 차단 조건이다.

- feature branch push가 prod deploy job을 시작할 수 있다.
- Jenkins multibranch가 모든 branch에서 deploy stage를 실행한다.
- prod environment required reviewer가 제거되어 있다.
- prod admin bypass가 다시 허용된 상태에서 "approval 없이는 prod 배포 불가"를 운영 보장으로 요구한다.
- workflow branch guard가 제거되어 environment 승인만 남아 있다.
- prod secret이 repository-level secret에 넓게 공유되어 있다.

## 최종 추천

지금은 **1안: GitHub Actions + GHCR + SSH/Compose**를 운영 기본값으로 둔다. 이 선택은 Tomodachi MVP의 현재 규모, 단일 운영자 부담, 낮은 초기 비용, 이미 작성된 workflow/Compose surface와 가장 잘 맞는다.

2안은 운영 신뢰성 요구가 실제로 커졌을 때 옮긴다. 이때도 한 번에 모든 것을 cloud-native로 바꾸지 말고, managed PostgreSQL, runtime, OIDC 권한, DNS/TLS 순서로 나누어 검증한다.

3안은 기본 선택지가 아니다. Jenkins는 `jang-agent-potal`식 self-hosted 운영 경험을 참고할 수는 있지만, Tomodachi에서는 branch guard와 prod approval을 엄격하게 재설계할 수 있을 때만 예외적으로 검토한다.
