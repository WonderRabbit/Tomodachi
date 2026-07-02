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

현재 MVP는 Spring 백엔드가 준비되기 전에도 UI를 검증할 수 있도록 client boundary 뒤에서 정적 mock data를 사용한다. 백엔드 계약이 확정되면 `src/mockData.ts`와 query 함수를 생성된 OpenAPI client로 교체한다.

## 환경 설정

Vite가 노출하는 값은 `VITE_` 접두사를 가진 변수만 사용한다. `src/config/appConfig.ts`는 `local`, `dev`, `prod`와 backend API base URL을 typed config로 파싱하지만, 현재 data source는 의도적으로 `mock`으로 고정되어 있다.

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
