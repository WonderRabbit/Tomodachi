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
