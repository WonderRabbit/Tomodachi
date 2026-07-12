# Tomodachi 작업 이력·계획·AGENTS 개선 계획

**작성 기준일:** 2026-07-12 KST
**상태:** 계획 승인 후 작성됨, 실행 전
**범위:** 현재 작업트리의 추적 소스, `plan/`, 로컬 `.omo` 이력, root/backend/front/research `AGENTS.md`

여기서 "작업 이력"은 저장소의 계획·지침·검증 증적·research snapshot을 뜻한다. 제품 화면의 Agent Run 이력 기능, Agent Run persistence/ingestion, API filtering·authorization, frontend-backend 연동은 이 문서의 범위가 아니며 별도 제품 기능 계획으로 다룬다.

## 1. 목적과 판정 규칙

이 계획은 과거 작업 산출물을 삭제하거나 현재 제품 동작을 바꾸지 않는다. 목표는 다음 세 종류의 문서를 같은 기준으로 정렬하는 것이다.

1. 현재 사실을 안내해야 하는 `AGENTS.md`, 운영/제품 계획 문서
2. 구현 전제를 설명하는 UI·backend·DB·배포 계약
3. 수행 당시의 사실만 증명하는 `.omo` 작업 이력과 research snapshot

### 증거 우선순위

| 우선순위 | 증거 | 사용할 주장 |
| --- | --- | --- |
| 1 | 현재 추적 소스·설정·workflow·테스트 | 현재 동작과 현재 계약 |
| 2 | Git commit/diff | 언제 무엇이 변경됐는지 |
| 3 | `plan/`, `docs/` | 의도·결정·미래 작업 |
| 4 | `.omo` ledger/evidence | 특정 시점의 실행·검토 증거 |
| 5 | research pack | 날짜가 붙은 추천·조사 snapshot |

`.omo` 또는 research의 오래된 성공 로그가 현재 상태를 대체하면 안 된다. 반대로, 단지 오래됐다는 이유만으로 삭제하거나 “틀렸다”고 단정하지 않는다.

## 2. 교차검증 결과와 개선 방향

| ID | 검증된 문제 | 교차 근거 | 왜 고쳐야 하는가 | 방치 시 사이드 이펙트 | 최선안 | 차선안 |
| --- | --- | --- | --- | --- | --- |
| P1 | root `AGENTS.md`가 `f762ece` 시점에 고정돼 있고 workflow가 없다고 설명한다. | `AGENTS.md:3-5,86`; `git log`의 `0a07266`; `.github/workflows/{ci,image-publish,deploy-dev,deploy-prod,deploy-qa}.yml` | 작업자가 실제 CI/CD·배포 경로를 찾을 수 있어야 한다. | 로컬 전용 검증만 실행하거나 배포 guard를 우회하는 계획을 만들 수 있다. | root `AGENTS.md`를 현재 HEAD 기준으로 재생성하고 `deploy/`, `scripts/`, `.github/workflows/`, `docs/`를 지도에 추가한다. 문서 생성 기준 commit/date와 재검증 명령을 기록한다. | 잘못된 “workflow 없음” 문장만 제거하고 운영 영역을 별도 `docs/environment-contract.md` 링크로 연결한다. |
| P2 | UI 계획의 원본 근거 3개가 없고, 계획의 일부 API/route가 구현에 없다. | `plan/ui-ux-mvp-flow.md:5,9-11,101-105`; `front/src/router.tsx:24-109`; API controllers mapping | 구현 완료 범위와 향후 backlog를 분리해야 한다. | 존재하지 않는 `/api/search`, `/api/auth/me`, `/login`, product detail을 전제로 UI 연동을 시작해 재작업한다. | UI 계획을 “현재 MVP”와 “backend 연동 backlog”로 분리하고, 누락 route/API마다 owner, API contract, 인수 테스트를 명시한다. 깨진 `.omo` provenance는 현재 Git commit/README로 교체한다. | 단일 문서를 유지하되 모든 미구현 항목에 `Planned` 상태와 추적 issue/ADR 링크를 붙인다. |
| P3 | 프런트 mock 모델과 backend DTO가 직접 호환되지 않는다. | `front/src/types.ts:19-83`; `backend/src/main/kotlin/com/tomodachi/backend/api/Dto.kt:19-59`; `front/src/config/appConfig.ts:10-15,41-49` | mock을 API로 바꿀 때 사용자 화면 계약을 안전하게 보존해야 한다. | 누락 metric, 연결 ID, timestamp 때문에 dashboard/detail 화면이 깨지거나 임시 타입 우회가 생긴다. | 별도 API-integration phase에서 versioned view-model adapter, OpenAPI/contract fixture, MSW 또는 MockMvc contract test를 먼저 만든 후 data source flag를 바꾼다. | mock boundary는 유지하고, 화면별로 필요한 backend aggregate endpoint를 작은 단위로 추가한다. |
| P4 | schema의 authoritative owner가 분리돼 있다. | `db/init.sql`; `backend/.../domain/Entities.kt`; `backend/src/main/resources/application.yml:1-62`; `docs/environment-contract.md:13,20-23` | dev/prod는 validate만 하므로 SQL·JPA 불일치를 배포 전에 잡아야 한다. | 새 volume, 백업 복구, 신규 환경에서 schema validation 실패 또는 제약/인덱스 누락이 발생한다. | Flyway migration을 단일 schema owner로 채택하고, migration 후 `ddl-auto=validate`를 실행하는 reusable pre-merge command를 만든다. | `db/init.sql`을 유지하되 PostgreSQL ephemeral DB에서 init → backend validate → schema catalog diff를 수행하는 reusable pre-merge command를 추가한다. |
| P5 | CI/CD 계획에 remote GitHub Environment 상태가 현재 사실처럼 적혀 있다. | `plan/tomodachi-env-cicd.md:41-43,104`; workflow guards in `.github/workflows/deploy-prod.yml:38-53`; Git history `0a07266` | 로컬 checkout은 원격 reviewer/branch policy의 현재값을 증명하지 못한다. | 실제 승인·관리자 우회·브랜치 정책이 바뀌어도 문서가 안전하다고 오인한다. | remote claim에는 observed-at, source run/command, expiry를 붙이고 release 전 `gh api` 또는 UI readback 검증을 CI/운영 runbook에 넣는다. | 원격 상태 서술을 삭제하고, source-controlled workflow guard만 현재 계약으로 문서화한다. |
| P6 | `.omo`의 canonical status와 세부 목표가 충돌하며 evidence는 ignored local state다. | `.omo/boulder.json:1-14`; `.omo/plans/tomodachi-env-cicd.md:159-164`; `.omo/ulw-loop/019ef9e6-3db3-7e73-ac4e-e803b001bbe4/goals.json:11-96`; `.gitignore:21` | 과거 proof와 현재 backlog를 구분해야 계획이 반복·누락되지 않는다. | 완료된 작업을 다시 실행하거나 review-blocked를 영구 미해결로 취급한다. | 추적되는 `plan/history/index.md`에 canonical plan, status, commit, verified-at, superseded-by를 적고 `.omo`는 불변 증거로 남긴다. | `.omo` 안에만 상태 정정 note를 추가하되, repo-facing 문서에는 “local evidence only” 링크만 남긴다. |
| P7 | research pack의 tool/model 추천이 snapshot인데 현재 도구 상태와 다르다. | `research/AGENTS.md`; `research/*/README.md`; local `sg --version` = ast-grep 0.44.1 | 동적인 model, provider, 도구 가용성을 설계 사실로 승격하면 안 된다. | 존재하지 않는 도구 설치 작업을 중복하거나 오래된 모델/가격/benchmark에 의존한다. | pack마다 `observed_at`, command/output digest, source URL/date, promotion criteria를 가진 freshness note를 추가한다. | 기존 snapshot을 유지하고 해당 pack README 첫머리에 만료·재검증 경고만 추가한다. |

## 3. 목표 아키텍처와 범위

### 포함

- root/backend/front/research `AGENTS.md`의 현행화 및 재검증 규칙
- UI/UX 계획의 구현 사실·미구현 backlog 분리
- backend DTO, frontend view model, standalone SQL의 계약 검증 설계
- deploy/CI 문서에서 local fact와 remote fact를 구분하는 형식
- `.omo` 작업 이력의 추적 가능한 요약 인덱스와 supersession 규칙
- research snapshot freshness 메타데이터

### 제외

- 프런트의 backend API 연동 구현
- Flyway 도입 또는 schema migration 자체 구현
- GitHub Environment·cloud resource·secret 변경
- `.omo` evidence 삭제, 역사 재작성, 강제 Git history 수정
- provider/model 구매·배포 결정
- Agent Run entity/DTO/schema, list/detail/filter API, authorization, event ingestion, 화면 변경

## 4. 실행 순서

### Wave 1 — 사실 고정과 문서 안전장치

1. 작업 시작 시 `git status --short`, `git rev-parse HEAD`, `git log -1 --oneline`을 저장한다. 기존 untracked `AGENTS.md`는 사용자 변경으로 보존한다.
2. `AGENTS.md` 계층을 현재 source/deploy/workflow map과 비교한다. 현재 HEAD로 확인할 수 없는 원격/host facts에는 날짜와 재확인 명령을 쓴다. 각 untracked `AGENTS.md`를 수정하기 전에는 파일별 명시 승인을 받고, 승인 없이는 proposed patch만 생성한다.
3. `plan/history/index.md`를 만들고 각 plan에 `active|completed|superseded|historical-evidence` 상태, 근거 commit, last-verified, successor를 기록한다.

**인수 기준:** root AGENTS가 tracked workflow/deploy/doc 영역을 지도에 포함하고 “workflow 없음” 같은 반증된 문장이 없다. index는 `.omo`를 현재 source로 표기하지 않는다.

**QA:**

- Happy: `node scripts/validate-guidance.mjs --inventory plan/history/current-topology.json --proposal-only`가 0으로 종료하고, `git ls-files .github/workflows`와 inventory 차이가 없다.
- Failure: fixture `scripts/fixtures/guidance/stale-workflow-claim.md`를 `node scripts/validate-guidance.mjs --input ...`에 주면 0이 아닌 exit와 stale-claim diagnostic을 낸다. 실제 untracked AGENTS 파일은 수정하지 않는다.

### Wave 2 — 제품 계획과 API contract 경계

4. `plan/ui-ux-mvp-flow.md`를 current MVP와 planned backend integration으로 분할한다. 모든 planned API/route에는 endpoint owner와 구현 전 contract acceptance를 쓴다.
5. `front/src/types.ts`와 backend DTO의 field matrix를 만든다. 필드를 "existing", "aggregate needed", "UI-only", "remove"로 분류한다.
6. data source 전환 조건을 문서화한다: adapter/fixture test, loading/error/forbidden panel fallback, visual QA, rollback flag가 모두 통과하기 전 `backendIntegrationEnabled`를 변경하지 않는다.

**인수 기준:** UI plan에서 구현된 route와 planned route가 혼재하지 않고, 지원하지 않는 endpoint가 current API로 표현되지 않는다.

**QA:**

- Happy: `rg -n 'path:|/api/' front/src/router.tsx backend/src/main/kotlin/com/tomodachi/backend/api plan/ui-ux-mvp-flow.md`의 API/route claim을 matrix로 설명할 수 있다.
- Failure: planned endpoint가 backend controller에 없으면 UI plan은 `Planned`와 acceptance test를 갖고, production data-source 변경 task에 포함되지 않는다.

### Wave 3 — DB와 배포 계약의 검증 자동화

7. schema ownership ADR을 결정한다. preferred Flyway path와 fallback init-SQL verification path의 선택 기준, rollback, data migration owner를 명시한다.
8. 선택 전에도 local pre-merge schema verification을 추가한다. PostgreSQL 빈 DB에 `db/init.sql`을 적용하고 해당 profile에서 app schema validation을 실행하며, enum/check/index catalog를 snapshot/diff한다. CI workflow 변경은 별도 승인 없이는 하지 않는다.
9. `plan/tomodachi-env-cicd.md:43,104,145,159,312`, `docs/ci-cd-options.md:9,19,31,44,52,58,59,131`, 환경 문서에 있는 `WonderRabbit`, `can_admins_bypass`, branch policy target remote claims를 inventory로 열거해 dated evidence로 바꾸고, workflow source guard와 GitHub Environment readback을 구분한다.

**인수 기준:** schema 변경은 entity/enum/DTO/SQL 및 Postgres validation을 한 change set으로 검토하며, remote governance claim은 재확인 없이 current로 표시되지 않는다.

**QA:**

- Happy: `scripts/verify-schema-parity.sh --fixture scripts/fixtures/schema-parity/expected.json`가 disposable PostgreSQL init, `SPRING_PROFILES_ACTIVE=dev` validation, catalog compare를 수행해 0으로 종료한다.
- Failure: `scripts/verify-schema-parity.sh --fixture scripts/fixtures/schema-parity/missing-task-index.json`가 0이 아닌 exit와 `tasks` index mismatch를 출력한다.
- Remote claim happy: `node scripts/validate-remote-claims.mjs --inventory plan/history/remote-claims.json --paths plan/tomodachi-env-cicd.md docs/ci-cd-options.md docs/environment-contract.md`가 모든 target claim의 `observed_at`, `source`, `expires_at`, read-only recheck command를 확인하고, uninventoried current-tense remote claim을 거부한다.

### Wave 4 — 이력과 research의 수명 관리

10. `.omo` history를 삭제하지 않고 추적 index에서 parent/child/supersession을 명시한다. completion은 plan, commit, rerunnable verification의 세 증거가 있을 때만 `completed`로 쓴다. `scripts/validate-history-index.mjs`와 `scripts/fixtures/history-index/missing-last-verified.md`로 형식을 고정한다.
11. 정확한 pack manifest를 먼저 정의하고, 각 research pack에 dated snapshot marker와 freshness procedure를 추가한다. 모델/가격/availability/repository tool claim은 fresh primary source 또는 local probe가 있어야 implementation input이 된다.
12. duplicate helper-cli/wrapper strategy는 canonical contract와 supporting evidence를 링크로 연결한다. 내용 삭제는 explicit retention review 없이는 하지 않는다.

**인수 기준:** history index가 stale conflict를 숨기지 않고 classification·후속 조치를 명시하며, research recommendation은 snapshot/date/provenance 없이 active implementation contract로 승격되지 않는다.

**QA:**

- Happy: `node scripts/validate-history-index.mjs plan/history/index.md` and `node scripts/validate-research-freshness.mjs --manifest plan/history/research-pack-manifest.json` both exit 0.
- Failure: `node scripts/validate-history-index.mjs scripts/fixtures/history-index/missing-last-verified.md` and `node scripts/validate-research-freshness.mjs --manifest scripts/fixtures/research/missing-observed-at.json` both exit nonzero.

## 5. 위험 관리와 롤백

| 위험 | 예방 | 발생 시 대응 |
| --- | --- | --- |
| AGENTS 갱신이 사용자의 untracked 지침을 덮어씀 | `agents-authorizations.md`의 path/approver/time/scope receipt와 `validate-scope.mjs` allowlist를 확인한 뒤 hunk 단위 적용 | 해당 hunk만 revert하고 source mapping을 다시 대조 |
| UI 문서 수정이 mock boundary를 조기 해제하는 신호로 해석됨 | document "planned"와 gate를 명시, config 변경은 별도 task | `backendIntegrationEnabled: false` 유지, mock QA 재실행 |
| schema guard가 신규 deploy를 막음 | 첫 도입은 local report-only command 및 known-diff allowlist | pre-merge command를 advisory로 되돌리고 mismatch를 ADR로 triage |
| history cleanup이 증거를 잃음 | `.omo` 삭제 금지, index는 append/reference-only | index 변경만 revert하고 original evidence 보존 |
| 원격 상태가 문서 작성 직후 바뀜 | observed_at + recheck command + expiry | current claim을 historical claim으로 downgrade |

## 6. 최종 검증 매트릭스

| 대상 | 성공 조건 | 실패 조건 | 증거 |
| --- | --- | --- | --- |
| Guidance | current source map와 일치 | stale path/negative claim 또는 unapproved AGENTS write 검출 | `validate-guidance.mjs`, `validate-agents-authorization.mjs`, line-numbered diff |
| UI plan | current/planned contract 분리 | 없는 route/API를 current로 표시 | route/controller matrix, `npm run typecheck`, `npm run visual:qa` |
| Contract | schema and DTO checks executable | intentional mismatch가 검출되지 않음 | PostgreSQL ephemeral output, MockMvc/contract fixture |
| Operations | local vs remote claim 표시 | remote fact가 date/recheck 없이 current로 표기 또는 inventory 누락 | `validate-remote-claims.mjs` and command output |
| History/research | immutable evidence + lifecycle index | dated snapshot이 active fact로 승격 | `rg` metadata scan, Git/`.omo` source references |

## 7. 완료 정의

이 계획의 실행은 다음이 모두 성립할 때 완료다.

1. 모든 `AGENTS.md`가 현재 repository topology와 검증 명령을 설명하고, stale metadata가 제거되었다.
2. UI 계획은 current MVP, backend contract gap, deferred integration을 구분한다.
3. DB schema owner 결정 또는 fallback automated verification이 reusable local pre-merge command로 존재한다. CI 편입은 별도 승인 작업이다.
4. CI/CD 문서는 source-controlled guard와 externally observed state를 구분한다.
5. tracked history index가 active/superseded/historical evidence를 연결하며, `.omo` 원본은 보존된다.
6. research adoption은 dated freshness evidence 없이는 진행되지 않는다.
7. 각 변경은 targeted QA와 전체 relevant regression check를 통과하고, `validate-scope.mjs` allowlist 및 `agents-authorizations.md`에 없는 untracked user file은 변경하지 않는다.
