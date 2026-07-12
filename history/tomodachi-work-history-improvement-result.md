# Tomodachi 작업 이력 개선 구현 결과

- 작성일: 2026-07-12 KST
- 기준 HEAD: `0a07266d53b83cd07017ec912c616eecbcc3d693`
- 구현 범위: 계획·지침 제안·검증기·ADR·운영 문서·research freshness·이력 인덱스
- 제외 범위: 제품 Agent Run 기능, frontend/backend 연동, `db/init.sql`, 제품 소스, 배포 workflow, 원격 GitHub 설정
- 현재 종합 판정: **PASS. 구현과 F1~F4가 모두 승인됐고, goal·코드 품질·QA·보안·컨텍스트의 5개 review-work lane도 모두 PASS다. 최종 goal 판정의 신뢰도는 HIGH이며 남은 차단 이슈는 없다.**

## 요약

| 영역 | 구현 결과 | 현재 검증 상태 | 남은 조건 |
| --- | --- | --- | --- |
| 작업 이력 | `plan/history/index.md`에 13개 source의 canonical/superseded/historical lifecycle을 기록 | Task 6 gate 존재, complete validator 13행 및 절대 경로 read-before-reject 회귀 통과 | 완료 |
| AGENTS | 원본 4개를 보존하고 `plan/history/proposals/`에 제안만 작성 | 승인 영수증은 4개 모두 `pending`, 승인 write 0건 | 사용자가 파일별 승인한 뒤에만 원본 반영 |
| UI 계획 | current mock MVP와 planned route/API를 분리하고 matrix로 고정 | Task 3 독립 검증 confirmed, F1 UI 명령 exit 0 | 실제 backend 연동은 별도 작업 |
| 스키마 | `db/init.sql` 권위와 JPA validate 역할을 ADR로 결정하고 parity guard 구현 | 실제 PostgreSQL 16/JPA/catalog F3 APPROVE | 완료 |
| CI/CD 주장 | 원격 상태를 2026-07-03 관측·2026-08-02 만료 주장으로 전환 | Task 5 독립 검증 confirmed, F1 remote 명령 exit 0 | 만료 전 승인된 read-only 재관측 |
| research | 4개 pack에 `FRESHNESS.md`, digest, 90일 window, `not-promoted` 추가 | Task 7 독립 검증 confirmed, F1 freshness exit 0 | 승격 전 primary source/local probe 재검증 |
| 범위·보안 | exact allowlist, 보호 AGENTS hash, 최종 `.omo` 445개 manifest, 두 mutable prefix·두 exact control path, no-symlink/contained-read 경계 | fresh exact F4 exit 0·100경로, malicious allowlist 6/6 거부, 코드·보안 PASS | 비차단 LOW local race 관찰 |
| 회귀 | backend test, frontend typecheck/build, validator syntax/LOC, 실제 schema happy/negative | F2·F3 APPROVE, QA 37/37 PASS | 완료 |
| 최종 검토 | goal·code·QA·security·context 5개 lane | 전부 PASS, goal 신뢰도 HIGH | 완료 |

## 원래 문제와 개선 판단

### 1. 현재 사실과 과거 증거가 섞여 있었다

- 문제: `.omo`의 완료·차단·중복 run, tracked plan, Git chronology가 동일한 신뢰 수준처럼 사용됐다. 일부 plan은 완료 구현과 불일치했고, 오래된 `.omo` 성공 로그가 현재 상태처럼 읽힐 수 있었다.
- 사이드 이펙트: 완료 작업을 다시 수행하거나, 이미 대체된 계획을 현재 backlog로 오인하거나, 반대로 해결되지 않은 충돌을 숨길 수 있다.
- 왜 고쳐야 하나: 현재 동작은 source와 Git이, 과거 실행은 불변 증거가 설명해야 재현성과 감사 가능성이 유지된다.
- 최선: `current-tracked-source → git-chronology → plan-docs → classified-historical-evidence` 우선순위를 적용하고, 13개 source에 lifecycle·successor·conflict·follow-up을 명시한다.
- 차선: `.omo` 내부에 정정 note만 추가할 수 있으나 ignored local evidence에 머물러 다른 checkout과 공유되지 않는다.

### 2. AGENTS 안내가 stale했지만 원본은 사용자 소유 untracked 파일이었다

- 문제: root 안내는 workflow가 없다고 적었지만 현재 HEAD에는 `.github/workflows`, `deploy`, `docs`, `scripts`가 있다. 동시에 네 원본 AGENTS는 구현 시작 전부터 있던 사용자 입력이라 무단 수정할 수 없었다.
- 사이드 이펙트: stale 안내를 그대로 쓰면 CI/CD 경로를 놓치고, 원본을 바로 고치면 사용자 지침을 덮어쓰는 더 큰 부작용이 생긴다.
- 왜 고쳐야 하나: 지침의 정확성과 소유권을 동시에 지켜야 한다.
- 최선: SHA-256 기준선을 고정하고 원본은 보존한 채 `plan/history/proposals/{AGENTS,backend-AGENTS,front-AGENTS,research-AGENTS}.md`만 작성한다. `agents-authorizations.md`는 네 건 모두 `pending`, approver `null`이다.
- 차선: 반증된 한 문장만 삭제할 수 있으나, 이 역시 파일별 명시 승인이 있어야 한다.

### 3. UI 계획이 현재 mock MVP와 미래 API를 혼합했다

- 문제: `/login`, `/products/$productId`, `/workspaces/$workspaceId`, search/auth-me/detail/sync-summary가 구현된 current 계약처럼 읽혔지만 route/controller와 맞지 않았다. 깨진 `.omo` provenance도 있었다.
- 사이드 이펙트: 존재하지 않는 API를 전제로 연동을 시작하거나, frontend mock 모델과 backend DTO 차이를 무시해 화면·타입 회귀가 생길 수 있다.
- 왜 고쳐야 하나: 문서상 current/planned 구분이 data-source 전환의 안전장치다.
- 최선: 15개 UI route와 6개 API claim을 owner/status/source/acceptance matrix로 고정하고, `dataSource: "mock"`, `backendIntegrationEnabled: false`를 유지한다.
- 차선: 단일 문서를 유지하되 모든 미구현 항목에 `Planned`와 인수 조건을 붙인다.

### 4. SQL과 JPA 사이의 권위·검증 경계가 불명확했다

- 문제: 배포 schema는 `db/init.sql`, dev/prod runtime은 JPA `ddl-auto=validate`, Flyway는 disabled 상태였다. 자동 parity 증거가 없었다.
- 사이드 이펙트: 신규 환경에서 테이블·PK·index drift로 startup이 실패하거나, JPA가 검증하지 않는 index 누락이 조용히 배포될 수 있다.
- 왜 고쳐야 하나: H2 test 성공은 PostgreSQL catalog 일치를 증명하지 않는다.
- 최선: 이번 범위에서는 `db/init.sql`을 권위로 확정하고, 일회용 PostgreSQL init → dev profile JPA validate → `pg_catalog` 비교를 수행하는 `scripts/verify-schema-parity.sh`를 사용한다. Flyway 전환은 migration baseline/rollback 승인이 필요한 별도 ADR로 보류한다.
- 차선 설계는 backend test와 정적 검증만 남기는 것이었으나, 최종 실행에서 실제 PostgreSQL F3가 통과해 이 fallback은 사용하지 않았다.

### 5. 원격 GitHub 상태가 현재 사실처럼 쓰였다

- 문제: reviewer `WonderRabbit`, `can_admins_bypass: false`, branch policy가 관측일 없이 현재형으로 반복됐다.
- 사이드 이펙트: 원격 설정이 바뀌어도 문서가 안전하다고 오인할 수 있고, source-controlled workflow guard와 원격 보호 설정의 증거 강도가 섞인다.
- 왜 고쳐야 하나: checkout만으로 원격 Environment 현재값을 증명할 수 없다.
- 최선: 안정 claim ID, `observedAt`, `expiresAt`, exact read-only `gh api --method GET` argv를 inventory로 고정하고 로컬 workflow fact와 분리한다.
- 차선: 원격 주장을 삭제하고 로컬 workflow guard만 current fact로 유지한다.

### 6. research 추천이 날짜 없는 구현 입력으로 승격될 위험이 있었다

- 문제: model/provider/tool 결론은 2026-06 snapshot인데 현재 계약처럼 소비될 수 있었다.
- 사이드 이펙트: 오래된 availability·가격·benchmark 또는 로컬 도구 상태를 근거로 잘못된 구현·구매 결정을 내릴 수 있다.
- 왜 고쳐야 하나: 동적 사실은 관측 시점과 재검증 절차 없이는 재사용할 수 없다.
- 최선: 정확한 4-pack manifest, README digest, `observedAt`, 90일 만료, `not-promoted` 상태를 유지하고 fresh primary source/local probe가 있어야 승격한다.
- 차선: README 첫머리에 만료 경고만 추가할 수 있으나 기계 검증이 없어 누락 가능성이 크다.

### 7. 검증기 자체에도 범위·보안 우회가 있었다

- 문제: 초기 구현은 POSIX literal-backslash allowlist 우회, precedence의 무관한 부정문 우회/오탐, AGENTS 및 입력 path의 symlink follow, history positional absolute path의 외부 read, Docker mutable tag의 암묵 pull 가능성을 가졌다.
- 사이드 이펙트: 금지 경로를 허용하거나 외부 파일을 읽어 로그로 노출하고, 검증 과정에서 승인되지 않은 원격 image를 실행할 수 있다.
- 왜 고쳐야 하나: 이 작업의 핵심은 문서보다도 “승인 범위와 증거를 거짓 성공 없이 검증하는 것”이다.
- 최선: 공통 runtime에서 절대 경로·lexical traversal·모든 path component/final symlink를 거부하고 canonical containment·regular file을 확인한다. history positional input도 이 경계를 통과한 뒤에만 읽는다. Docker는 로컬 immutable image ID를 확인하고 해당 ID를 `--pull=never`로 실행한다. promotion/negation은 동일 reference의 관계-local 의미로만 결합한다.
- 차선: 각 validator에 개별 `lstat` 검사를 둘 수 있으나 부모 symlink와 정책 중복이 남는다. Docker는 digest-pinned image를 승인된 별도 단계에서 pull할 수 있으나 검증 명령 자체는 계속 `--pull=never`여야 한다.

## 교차검증된 작업 흐름

1. 초기 기준선 고정: HEAD, Git chronology, pre-existing untracked AGENTS 4개 hash와 `.omo` 450개 path/size/SHA-256을 기록했다. 이 최초 snapshot의 manifest hash는 `6ededb73c707f2cd4e0a6c06777c6c691d88c452586df7b7a53d8151dffbea65`다.
2. Task 1: history/scope validator와 RED→GREEN 증거 기반을 만들었다. 독립 검증에서 literal backslash 우회를 발견해 RED exit 0 → GREEN exit 1로 닫았다.
3. Task 2~3: AGENTS proposal-only 경계와 UI current/planned matrix를 만들고, canonical path/set·pin·alias 우회를 독립 verifier가 재검증했다.
4. Task 4~5: schema ADR/parity guard와 dated remote-claim inventory를 구현했다. Docker lifecycle·소유권·process-group·fixture 경계 반례와 원격 주장 난독화/현재형 우회를 반복 RED→GREEN으로 닫았다.
5. Task 6~7: 13-source lifecycle index/evidence precedence와 4-pack freshness 계약을 구현했다. negation 결합, encoded link, exact schema/path 검사를 보강했다.
6. 최종 F1~F4 및 5개 review를 실행했다. 초기 최종 review에서 F1 CLI drift, research README allowlist 누락, UI commit 의미 불일치, precedence valid fixture 오탐, symlink 외부 읽기, Docker pull 위험을 발견했다.
7. 후속 수정: `--proposal-only` strict alias, README 4개 exact allowlist, UI latest-modifying commit `49640fc...`, relation-local negation, no-symlink common read, 로컬 image + `--pull=never`를 적용했다.
8. 최종 검증: F1~F4는 모두 APPROVE이고 goal·코드 품질·QA·보안·컨텍스트 5개 review-work lane은 모두 PASS다. QA는 37/37이며 goal 판정 신뢰도는 HIGH다. history 절대 경로 read-before-reject와 Task 6 gate, 실제 PostgreSQL 16 정상/negative schema 검증까지 완료됐다.
9. ULW control-plane 정리: 독립 gate 승인 뒤 active plan의 11개 checkbox와 Boulder work status를 completed로 갱신했다. C001·C002·C003, fresh code review, QA, quality gate가 모두 PASS했고 exact F4는 exit 0·100경로를 확인했다. 금지 경로를 고의로 허용한 faithful malicious allowlist도 backend/front/DB/workflow/deploy/Agent Run 6개 클래스를 6/6 exit 1로 거부했다.
10. 최종 ULW checkpoint: `2026-07-12T06:31:33.943Z`에 ledger가 `aggregate_completed`를 기록했고 G001 aggregate goal이 `complete`가 됐다. persisted Codex aggregate objective와 승인된 실행 목표, C001~C003 captured evidence가 같은 완료 상태로 정합화됐다.

## 변경 산출물

### 이력·승인·계약

- `plan/history/index.md`: 13-source lifecycle ledger와 증거 우선순위
- `plan/history/execution-baseline.json`: HEAD, 보호 입력, `.omo` manifest 기준
- `plan/history/scope-allowlist.json`: exact 승인 경로와 제한된 evidence prefix
- `plan/history/agents-authorizations.md`: AGENTS 4개 pending 승인 영수증
- `plan/history/current-topology.json`: 현재 repository topology
- `plan/history/ui-contract-matrix.json`: UI route/API current/planned 계약
- `plan/history/remote-claims.json`: 날짜·만료·read-only 재검증 원격 주장
- `plan/history/research-pack-manifest.json`: 정확한 4개 research pack 목록

### 제안·문서

- `plan/history/proposals/*.md`: 승인 전용 AGENTS 제안 4개
- `plan/ui-ux-mvp-flow.md`: current mock MVP와 planned integration 분리
- `plan/tomodachi-env-cicd.md`, `docs/ci-cd-options.md`, `docs/environment-contract.md`: local fact/remote observation 분리
- `docs/adr/001-schema-ownership.md`: `db/init.sql` 권위와 parity 결정
- `research/*/FRESHNESS.md`, 해당 README 4개: freshness 링크와 `not-promoted` 상태

### 실행 검증 표면

- `scripts/validate-{history-index,guidance,agents-authorization,ui-contract-plan,remote-claims,research-freshness,evidence-precedence,scope}.mjs`
- `scripts/lib/{validator-runtime,git-status}.mjs`
- `scripts/verify-schema-parity.sh`
- `scripts/fixtures/**`: happy/contract failure/malformed/adversarial 회귀 fixture
- `.omo/evidence/tomodachi-work-history-improvement/**`: Task 1~7, gate review, F1~F4, review/debugging 증적. 이 경로는 증거 출력이며 제품 source가 아니다.

## RED → GREEN과 적대 검증 결과

- History/scope: validator 부재 RED 이후 happy path GREEN. literal POSIX backslash 금지 경로는 수정 전 exit 0, 수정 후 exit 1.
- Guidance: 초기 `--proposal-only` 미지원 exit 2를 보완했고 현재 F1 literal 명령은 exit 0. duplicate/mixed modes는 exit 2, stale claim은 exit 1.
- UI: current/planned 혼합과 missing API status를 거부한다. 비정규 route/API alias, alternate-plan pin 우회, computed unsupported syntax는 fail closed한다.
- Schema: guard 부재 exit 127에서 구현됐다. malformed/symlink/out-of-repo fixture, forged ownership, partial container, child process, trap 순서, shell injection을 적대 검증했다. 실제 PostgreSQL 16에서 expected fixture는 exit 0 GREEN, negative fixture는 exit 1과 정확한 `tasks index mismatch`를 냈고 두 경로 모두 `cleanup complete`와 런타임 자원 무잔여를 확인했다.
- Remote claims: current-tense·expired·malformed·난독화·중복 marker·comment/echo-only workflow 우회를 거부한다. 검증기는 `gh`를 실행하지 않는다.
- Evidence precedence: unrelated `not`이 current promotion을 숨기던 우회와 `superseded evidence, not current guidance` 오탐을 fixture-first로 수정했다.
- Research: encoded Markdown/HTML link, control 문자, 중복 status, alternate manifest, parent symlink를 거부한다.
- Shared path security: final/parent symlink와 외부 `/etc/passwd` status fixture를 읽기 전에 exit 2로 거부하고 외부 content token을 진단에 포함하지 않도록 수정했다.

## 정확한 검증 명령과 현재 결과

```bash
node scripts/validate-guidance.mjs --inventory plan/history/current-topology.json --proposal-only
node scripts/validate-history-index.mjs plan/history/index.md
node scripts/validate-ui-contract-plan.mjs --plan plan/ui-ux-mvp-flow.md --routes front/src/router.tsx --controllers backend/src/main/kotlin/com/tomodachi/backend/api
node scripts/validate-remote-claims.mjs --inventory plan/history/remote-claims.json --paths plan/tomodachi-env-cicd.md docs/ci-cd-options.md docs/environment-contract.md
node scripts/validate-research-freshness.mjs --manifest plan/history/research-pack-manifest.json
```

위 F1 다섯 명령은 최신 재감사에서 모두 exit 0으로 **APPROVE**됐다.

```bash
git diff --check
cd backend && ./gradlew test
cd front && npm run typecheck && npm run build
node scripts/validate-evidence-precedence.mjs --plans plan --forbid-current-source .omo
```

F2 네 명령은 모두 exit 0으로 **APPROVE**됐다. validator 8개의 `node --check`와 pure LOC 상한도 감사에서 통과했다. 후속 containment/no-pull 수정은 코드 품질 재검토와 최종 보안 재감사에서 모두 PASS를 받았다.

```bash
node scripts/validate-scope.mjs --repo . --baseline plan/history/execution-baseline.json --allowlist plan/history/scope-allowlist.json --agents-authorization plan/history/agents-authorizations.md --protected-omo-manifest .omo/evidence/tomodachi-work-history-improvement/baseline/protected-omo.sha256
```

기존 F4 감사는 research README 4개 누락으로 exit 1 `REJECT`였다. 이후 네 경로를 exact allowlist에 추가했고 당시 독립 F4 재감사는 97개 경로로 **APPROVE**했다. ULW control-plane과 최종 evidence까지 포함한 fresh exact F4는 exit 0, `checkedPaths:100`, `agentsAuthorization:true`, `protectedOmo:true`다. final/parent symlink는 외부 내용을 읽기 전에 exit 2로 거부됐고, faithful malicious allowlist가 명시적으로 허용해도 backend/front/DB/workflow/deploy/Agent Run 6개 금지 클래스는 모두 exit 1이다.

```bash
scripts/verify-schema-parity.sh --fixture scripts/fixtures/schema-parity/expected.json
scripts/verify-schema-parity.sh --fixture scripts/fixtures/schema-parity/missing-task-index.json
```

F3 실행 전 사용자의 명시적 승인을 받아 검증 prerequisite인 `postgres:16-alpine` 이미지만 획득했다. pull과 inspect가 확인한 immutable provenance는 `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`이며, 이후 검증은 이 image ID와 `--pull=never`만 사용했다.

- expected fixture: 실제 일회용 PostgreSQL 16에 `db/init.sql`을 적용하고 backend `dev` JPA validation 및 `pg_catalog` 비교까지 수행해 exit 0과 `PASS db/init.sql + JPA validate + pg_catalog fixture`를 관측했다.
- missing-index fixture: exit 1과 `tasks index mismatch: unexpected actual ix_tasks_project_id`를 관측해 의도적 negative 계약을 확인했다.
- cleanup: 두 실행 모두 `cleanup complete`; schema container, backend/Gradle process, 임시 디렉터리 잔존 0건이다. 승인된 pinned PostgreSQL image만 로컬 prerequisite로 남았다.

## AGENTS 승인 상태

원본 `AGENTS.md`, `backend/AGENTS.md`, `front/AGENTS.md`, `research/AGENTS.md`는 baseline SHA-256과 일치한다. 승인 영수증은 모두 `pending`, approver `null`, authorized write 0건이다. 사용자의 이번 “계획 실행 승인”을 네 원본 파일별 content 적용 승인으로 확대 해석하지 않았다. 따라서 제안 파일만 생성했고 원본에는 반영하지 않았다.

## 보존 경계와 사이드 이펙트 통제

- `backend/src/**`, `front/src/**`, `db/init.sql`, `.github/workflows/**`, `deploy/**`, Agent Run 구현은 변경하지 않았다.
- frontend는 계속 mock mode이며 backend integration flag를 바꾸지 않았다.
- Flyway와 CI 편입은 별도 승인 사항으로 남겼다.
- 원격 GitHub API/Environment/cloud/secret을 조회하거나 변경하지 않았다. remote claim의 argv는 데이터로만 검증했다.
- 유일한 명시적 외부 획득은 사용자 승인하에 실행한 `docker pull postgres:16-alpine`이며, 확인된 digest는 `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`다. 그 밖의 image, package, credential, 원격 설정은 획득·변경하지 않았다.
- commit, push, rebase, reset, stash를 수행하지 않았다. HEAD와 upstream은 기준 시점에 동일했다.
- 신규 package/lockfile 의존성을 추가하지 않았다.

### 보호 `.omo` 복구와 ULW control-plane 계약

초기 orchestration 중 당시 보호 대상이던 `.omo/plans/tomodachi-work-history-improvement.md`와 `.omo/start-work/ledger.jsonl`의 drift를 scope validator가 탐지했다. 두 파일은 먼저 원래 크기/hash로 복원했고, 최초 450-entry manifest는 갱신하지 않은 채 그대로 검증해 drift를 숨기지 않았다. 당시 복원 receipt의 plan hash는 `f09ff7b6b5313174e3a28f6d10f10870bee8d0992ec09c4f78c6ed4adbd6dfaa`, ledger hash는 `8d6140a4f82cd7afae84ce41bd17361678d457392f562bf49fcdaafda59b5325`였다.

그 후 명시적 `ulw-loop`를 정상적으로 닫으려면 active ULW goal/ledger와 active plan/Boulder status를 갱신해야 하지만, 최초 manifest는 이 control-plane 파일까지 불변으로 막는 구조적 충돌이 확인됐다. 독립 RED/gate 뒤 권한을 넓게 풀지 않고 계약을 다음처럼 최소 교정했다.

- 초기 보호 snapshot: 450 entries, SHA-256 `6ededb73c707f2cd4e0a6c06777c6c691d88c452586df7b7a53d8151dffbea65`
- 최종 보호 계약: 445 historical `.omo` entries, SHA-256 `9299dc97660a937d1b99f538f790210736050a49bfdc224ffa44b2bdd3ae3eab`
- 정확히 두 mutable `.omo` prefix: `.omo/evidence/tomodachi-work-history-improvement/`, `.omo/ulw-loop/tomodachi-work-history-implementation-20260712/`
- 정확히 두 mutable control path: `.omo/boulder.json`, `.omo/plans/tomodachi-work-history-improvement.md`

이는 숨은 baseline refresh가 아니라 최초 450/hash를 chronology로 보존한 상태에서 active control-plane 5개 표면만 명시적으로 분리한 것이다. 인접 `.omo/ulw-loop/*`, 다른 `.omo/plans/*`, root `.omo` 추가·변조는 계속 실패하며 나머지 445개 historical entry의 path/size/hash는 보호된다. plan checkbox와 Boulder는 completed이고 C001~C003은 pass다. 이 준비 상태를 바탕으로 최종 aggregate checkpoint까지 성공해 ULW goal status도 `complete`로 전환됐다.

## 최종 review에서 발견해 수정한 결함

| 결함 | 원래 판정 | 적용 수정 | 재실행 상태 |
| --- | --- | --- | --- |
| F1 `--proposal-only` interface drift | F1 REJECT | strict boolean compatibility mode 추가 | F1 재감사 APPROVE |
| research README 4개 allowlist 누락 | F4/review FAIL | exact path 4개만 추가 | F4 재감사 APPROVE |
| UI history commit 의미 불일치 | context review FAIL | latest modifying commit `49640fc...`로 통일 | history/current 계약 검증 통과 |
| valid superseded evidence 오탐 | QA FAIL | relation-local negation 보강 | 최종 QA 37/37 PASS; F3 happy/negative도 실표면 통과 |
| AGENTS/fixture symlink 및 history absolute path 외부 읽기 | code/security FAIL, HIGH | 공통 no-symlink/canonical contained-read와 history positional input 경계 | 코드 품질 PASS, 최종 보안 재감사 PASS |
| mutable Docker tag 암묵 pull | security FAIL, HIGH | 승인된 1회 pull provenance 확인 후 immutable image ID 실행 결속 + `--pull=never` | 최종 보안 재감사 PASS, F3 APPROVE |
| 일회용 DB 암호 예측 가능성 | security LOW | 128-bit ownership token 기반 생성 | 정적/모의 검증 완료 |

과거 review 문서는 당시 실패를 보존하는 역사 증거다. 수정됐다는 이유로 기존 FAIL을 덮어쓰지 않았고, 각 수정 뒤 독립 rerun과 최종 ULW checkpoint까지 완료한 현재 구현·aggregate 판정은 PASS다.

## 비차단 후속 사항

1. schema guard 범위: 후속 커밋에서 실제 table/index에 더해 CHECK/FK catalog 비교까지 확장했다. 다만 CHECK/FK의 도메인 의미 전체와 data migration 호환성은 이 가드 범위가 아니다.
2. TOCTOU 방어 깊이: Node path 검사 후 read 사이를 동시에 바꿀 수 있는 동일 계정 공격은 file-descriptor/inode 기반 처리까지 가지 않아 LOW로 남아 있다.
3. LOC 경계: 후속 커밋에서 remote-claims validator의 CLI wrapper와 계약 검증 lib를 분리했다. 다음 기능 추가는 `scripts/lib/remote-claims-contract.mjs` 쪽에 국소화한다.
4. AGENTS 적용: 네 제안은 자동 적용하지 말고 파일별 승인·diff 검토 후 반영해야 한다.
5. research/remote freshness: 만료 시점에는 승인된 read-only 재관측으로 inventory를 갱신해야 한다.
6. ULW control-plane: 구현·criteria·plan/Boulder와 aggregate checkpoint가 모두 완료됐다. C001~C003, fresh code/QA/gate, malicious allowlist 6/6, exact F4 100경로가 최종 완료 근거다.

즉시 필요한 추가 shell command는 없다. 재현이 필요할 때의 exact schema 명령은 다음과 같으며, 둘 다 위 digest의 local image와 `--pull=never`를 사용한다.

```bash
scripts/verify-schema-parity.sh --fixture scripts/fixtures/schema-parity/expected.json
scripts/verify-schema-parity.sh --fixture scripts/fixtures/schema-parity/missing-task-index.json
```

현재의 정확한 최종 표현은 **“전체 PASS: F1~F4 APPROVE, 5개 review-work lane PASS, QA 37/37, C001~C003 PASS, exact F4 100경로, malicious allowlist 6/6 거부, Codex aggregate goal 정합화 및 ULW checkpoint complete”**다.
