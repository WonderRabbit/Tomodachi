# UI contract fixture: missing API status

<!-- ui-contract-plan: v1 -->

## 현재 MVP 계약

| 상태 | Route | Owner |
| --- | --- | --- |
| Current | `/` | fixture |
| Current | `/products` | fixture |
| Current | `/projects` | fixture |
| Current | `/projects/$projectId` | fixture |
| Current | `/projects/$projectId/tasks/board` | fixture |
| Current | `/tasks` | fixture |
| Current | `/tasks/$taskId` | fixture |
| Current | `/architecture` | fixture |
| Current | `/architecture/adr/$artifactId` | fixture |
| Current | `/agent-runs` | fixture |
| Current | `/agent-runs/$runId` | fixture |
| Current | `/settings` | fixture |
| Planned | `/login` | fixture |
| Planned | `/products/$productId` | fixture |
| Planned | `/workspaces/$workspaceId` | fixture |

## Backend 연동 계획

| 상태 | API claim | Owner |
| --- | --- | --- |
| Current | `GET /api/products` | fixture |
| Current | `POST /api/auth/login` | fixture |
| Planned | `GET /api/auth/me` | fixture |
| Planned | `GET /api/products/{productId}` | fixture |
| Planned | `GET /api/integrations/opencode/sync-summary` | fixture |

`GET /api/search`는 검색 결과를 제공하지만 이 행에는 상태가 없다.

이 fixture는 API claim에 `Current` 또는 `Planned` 분류가 없으므로 validator가 거부해야 한다.
