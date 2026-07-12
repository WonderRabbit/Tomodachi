# 프로젝트 지식 베이스

**적용 기준 Commit:** `0a07266d53b83cd07017ec912c616eecbcc3d693`
**이전 원본 SHA-256:** `e7034d1f574e446b07cedeb1c7209ba3b2354c73f9edd82613fd41a9e2a99293`
**적용 승인:** 2026-07-12 사용자 승인

## 개요

Tomodachi는 Kotlin/Spring Boot 백엔드, React/Vite 프런트, SQL schema mirror, Compose 배포, GitHub Actions, 운영 문서, 리서치 pack을 함께 관리하는 내부 도구 MVP다.

## 현재 구조

```text
Tomodachi/
├── .github/workflows/ # CI, image publish, dev/prod deploy, deploy QA
├── backend/           # Spring Boot API와 통합 테스트
├── db/                # standalone init.sql schema mirror
├── deploy/            # Dockerfile, Compose overlay, 환경 검증, Caddy/nginx
├── docs/              # 설치, 환경 계약, CI/CD와 배포 runbook
├── front/             # Vite React 운영 UI와 runtime config 검증
├── plan/              # 제품·운영 계획과 history inventory
├── research/          # 날짜가 있는 의사결정 snapshot
└── scripts/           # Linux/macOS zsh 및 PowerShell 배포 wrapper
```

`backend/build`, `backend/.gradle`, `front/dist`, `front/node_modules`, `.omo`, `.codegraph`는 생성물 또는 로컬 증적이며 제품 source로 판단하지 않는다.

## 어디를 볼지

| 작업 | 위치 | 현재 계약 |
| --- | --- | --- |
| Backend API와 상태 전이 | `backend/src/main/kotlin/com/tomodachi/backend` | controller, security, service, JPA domain이 소유한다. |
| Frontend route와 상태 | `front/src`, `front/DESIGN.md` | auth/products backend adapter와 남은 mock query boundary, panel fallback을 함께 유지한다. |
| DB mirror | `db/init.sql` | Kotlin enum/entity 및 TypeScript union과 함께 검토한다. |
| Local/dev/prod Compose | `deploy/docker-compose*.yml`, `deploy/validate-compose-env.sh` | 환경 template 검증 후 config를 render한다. |
| CI/CD | `.github/workflows/*.yml` | CI, GHCR publish, dev/prod 배포, live deploy QA가 추적돼 있다. |
| 운영 절차 | `docs/environment-contract.md`, `docs/deployment-*.md`, `docs/ci-cd-options.md` | 원격 사실은 확인 날짜와 재검증 근거를 구분한다. |
| 배포 wrapper | `scripts/deploy.sh`, `scripts/deploy.ps1` | 지원 명령과 platform 요구 조건은 wrapper help로 확인한다. |
| Research | `research/opencode-*` | snapshot claim은 source와 관찰 시점을 보존한다. |

## 유지 규칙

- 프런트에서 OpenCode나 agent tool을 직접 호출하지 않는다. agent data는 백엔드가 소유하고 정규화한 summary만 표시한다.
- agent tool 구현은 scoped backend service를 거치며 direct database access 경로를 추가하지 않는다.
- DB enum/check constraint 변경은 Kotlin enum/entity/DTO와 TypeScript union을 같은 change set에서 맞춘다.
- UI error/empty/forbidden/stale 상태는 dashboard 전체 blank 대신 panel 단위 fallback으로 유지한다.
- `.omo` evidence를 current source로 승격하거나 삭제해 역사를 다시 쓰지 않는다.
- GitHub Environment, secret, host 상태는 repository 파일만으로 확정하지 않고 dated readback을 요구한다.

## 검증 명령

```bash
cd backend && ./gradlew test
cd front && npm run typecheck && npm run build && npm run verify:runtime-config
sh deploy/validate-compose-env.sh --env-file deploy/env.dev.template
docker compose --env-file deploy/env.dev.template -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml --project-directory . config
ruby -e 'require "yaml"; ARGV.each { |file| YAML.load_file(file) }' .github/workflows/*.yml
node scripts/validate-guidance.mjs --inventory plan/history/current-topology.json --proposal-dir plan/history/proposals
```

재검증 시 `git rev-parse HEAD`, `git ls-files .github/workflows deploy docs scripts`를 inventory와 먼저 대조한다.
