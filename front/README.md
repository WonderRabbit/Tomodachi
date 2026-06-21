# Tomodachi Frontend MVP

This is the dashboard-first frontend MVP for Tomodachi, created under `Tomodachi/front`.

## Stack

- React + Vite + TypeScript
- TanStack Router
- TanStack Query
- TanStack Table
- Zustand
- shadcn-compatible local primitives
- lucide-react icons

## Commands

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

The MVP currently uses static mock data through a client boundary so the UI can be verified before the Spring backend is available. Replace `src/mockData.ts` and the query functions with generated OpenAPI clients when the backend contract is ready.

## Routes

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
