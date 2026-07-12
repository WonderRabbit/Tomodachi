# Tomodachi 프론트엔드 MVP

`Tomodachi/front` 하위에 생성한 Tomodachi 대시보드 우선 프론트엔드 MVP다.

## 기술 스택

- React + Vite + TypeScript
- TanStack Router
- TanStack Query
- TanStack Table
- Zustand
- shadcn 호환 로컬 primitive
- lucide-react 아이콘

## 명령어

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

현재 MVP는 하이브리드 데이터 소스다. 인증, products, projects, tasks, global search, OpenCode sync summary는 Spring 백엔드 API를 사용한다. Dashboard, architecture, agent runs, settings, AppShell product switcher 일부 표시는 아직 `src/mockData.ts` / `src/data/*`의 정적 MVP 데이터를 사용한다. 남은 mock boundary는 각 route 단위로 backend adapter 또는 생성 OpenAPI client로 교체한다.

## 환경 설정

Vite가 노출하는 값은 `VITE_` 접두사를 가진 변수만 사용한다. `src/config/appConfig.ts`는 `local`, `dev`, `prod`와 backend API base URL을 typed config로 파싱한다. backend adapter가 적용된 화면은 `VITE_TOMODACHI_API_BASE_URL`로 요청하고, 아직 전환되지 않은 화면만 mock boundary를 유지한다.

```bash
cp env/local.example .env.local
npm run dev

cp env/dev.example .env.dev
npm run build -- --mode dev

cp env/prod.example .env.prod
npm run build -- --mode prod
```

- `VITE_TOMODACHI_ENV`: `local`, `dev`, `prod`
- `VITE_TOMODACHI_API_BASE_URL`: backend API origin 또는 base path. 값이 비어 있으면 환경별 example-safe 기본값으로 fallback한다.

## 라우트

- `/`
- `/products`
- `/projects`
- `/projects/$projectId`
- `/projects/$projectId/tasks/board`
- `/tasks`
- `/tasks/$taskId`
- `/architecture`
- `/architecture/adr/$artifactId`
- `/agent-runs`
- `/agent-runs/$runId`
- `/settings`

## 현재 backend-backed 표면

- 로그인/현재 사용자: `POST /api/auth/login`, `GET /api/auth/me`
- Products: `GET /api/products`, `GET /api/products/{productId}`
- Projects: `GET /api/projects`, `GET /api/projects/{projectId}`
- Tasks: `GET /api/tasks`, `GET /api/opencode/task-context/{taskId}`
- Global search: `GET /api/search?q=&type=`
- Topbar sync badge: `GET /api/integrations/opencode/sync-summary`

남은 mock 표면은 Dashboard 집계, Architecture route, Agent Runs route, Settings, AppShell product switcher다.
