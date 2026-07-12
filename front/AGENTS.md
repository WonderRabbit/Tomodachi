# 프런트엔드 지식 베이스

**적용 기준 Commit:** `0a07266d53b83cd07017ec912c616eecbcc3d693`
**이전 원본 SHA-256:** `38bc61c002961fc4be622b8803e54223da72da64ecb8015ce177ab1524277037`
**적용 승인:** 2026-07-12 사용자 승인

## 현재 표면

React 19, Vite 6, TypeScript 기반 운영 dashboard다. TanStack Router/Query/Table, Zustand, lucide-react를 사용한다. `src/config/appConfig.ts`가 환경 입력을 파싱하며 현재 `backendIntegrationEnabled`는 `true`, `dataSource`는 `hybrid`다.

| 작업 | 위치 | 규칙 |
| --- | --- | --- |
| Route | `src/router.tsx`, `src/pages` | URL 복원 context는 Router가 소유한다. |
| UI local state | `src/store.ts` | sidebar, detail rail, search 같은 화면 상태만 둔다. |
| Data boundary | `src/api`, `src/data`, `src/mockData.ts`, `src/config` | `products`와 auth는 backend adapter를 사용하고, 나머지 화면은 backend 전환 acceptance 전 mock query seam을 유지한다. |
| Visual contract | `DESIGN.md`, `src/styles.css`, `src/components` | compact dashboard와 panel fallback을 유지한다. |
| Runtime config | `scripts/verify-runtime-config.mjs`, `env/*.example` | local/dev/prod URL과 잘못된 환경 입력을 검증한다. |

## 금지와 동기화 규칙

- Frontend에서 OpenCode나 agent tool을 직접 호출하지 않는다.
- landing hero나 과한 장식 대신 인증된 운영 dashboard 밀도를 유지한다.
- backend API field와 enum은 `src/types.ts`, backend DTO/enum, `db/init.sql`을 함께 대조한다.
- error/empty/forbidden/stale 상태를 전체 화면 blank로 숨기지 않는다.
- package script/dependency가 없는 테스트를 완료 증거로 주장하지 않는다.
- 배포된 frontend image의 환경은 build-time 계약이므로 `deploy/frontend.Dockerfile`과 workflow를 함께 확인한다.

## 검증

```bash
npm run typecheck
npm run build
npm run verify:runtime-config
npm run visual:qa
```

Visual QA는 기본적으로 `http://127.0.0.1:5173`과 `/private/tmp/tomodachi-front-qa`를 사용하므로 실행 전후 server/process를 정리한다.
