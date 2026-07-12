# 백엔드 지식 베이스 제안

**기준 Commit:** `0a07266d53b83cd07017ec912c616eecbcc3d693`
**원본 SHA-256:** `13f842e82ae45e6774bafc1f278ccab8c05df8ba1ea93f8ba3cf73c4da11dbd7`
**상태:** 원본 변경 승인을 받지 않은 proposal-only 초안

## 현재 표면

Kotlin 2.2.21, Spring Boot 3.5.9, Java 21 API 서버다. `api`, `security`, `service`, `domain`, `repo`, `config`가 lifecycle, agent context, task transition, audit/outbox를 소유한다.

| 작업 | 위치 | 규칙 |
| --- | --- | --- |
| Lifecycle API | `src/main/kotlin/com/tomodachi/backend/api/LifecycleController.kt` | product/project/task 조회와 생성 계약을 DTO와 함께 유지한다. |
| Task transition | `src/main/kotlin/com/tomodachi/backend/service/TaskTransitionService.kt` | role guard, 허용 전이, idempotency, audit/outbox transaction을 우회하지 않는다. |
| Agent facade | `src/main/kotlin/com/tomodachi/backend/api/AgentController.kt` | scoped service와 authorization을 보존한다. |
| Runtime profile | `src/main/resources/application.yml` | 기본 H2는 `ddl-auto: update`; `deploy`, `dev`, `prod`는 `validate`; Flyway는 비활성이다. |
| 검증 | `src/test/kotlin/com/tomodachi/backend` | MockMvc/H2 통합 테스트와 runtime profile test가 있다. |

## 금지와 동기화 규칙

- Task status write에서 `TaskTransitionService`를 우회하지 않는다.
- Agent endpoint에 repository direct-read 우회 경로를 만들지 않는다.
- `db/init.sql` 변경은 entity, enum, DTO 및 PostgreSQL profile 계약과 함께 검토한다.
- H2 PostgreSQL mode만 통과한 결과를 실제 PostgreSQL 호환 증거로 과장하지 않는다.
- 원격 DB나 배포 host 상태는 repository source가 아니며 dated runtime evidence 없이 current fact로 쓰지 않는다.

## 검증

```bash
./gradlew test
./gradlew bootRun
```

배포 profile은 `TOMODACHI_DATABASE_*` 환경 계약과 `deploy/` Compose 구성을 함께 확인한다.
