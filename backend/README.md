# Tomodachi 백엔드

Tomodachi의 제품, 프로젝트, 작업 운영을 위한 Kotlin Spring Boot 백엔드 MVP다.

## 실행

```bash
./gradlew test
./gradlew bootRun
```

로컬 seed 계정의 로그인용 평문 비밀번호는 모두 `password`다. 이 값은 로컬 개발/검증용으로만 문서화한다. 런타임 저장 시 `SeedData`가 `PasswordEncoder`로 해시한 값을 DB에 저장하므로 DB에는 평문을 넣지 않는다.

- `viewer@tomodachi.local`
- `engineer@tomodachi.local`
- `agent@tomodachi.local`
- `admin@tomodachi.local`

MVP는 로컬 기본 실행에서 H2 메모리 DB를 PostgreSQL 호환 모드로 사용한다.

## 데이터베이스 profile

기본 profile:

- `TOMODACHI_DATABASE_URL` 미설정 시 `jdbc:h2:mem:tomodachi;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1`
- Hibernate `ddl-auto: update`
- Flyway disabled

`dev` profile:

```bash
TOMODACHI_DATABASE_URL=jdbc:postgresql://localhost:5432/tomodachi_dev \
TOMODACHI_DATABASE_USER=tomodachi \
TOMODACHI_DATABASE_PASSWORD=tomodachi \
./gradlew bootRun --args='--spring.profiles.active=dev'
```

- PostgreSQL driver 사용
- Hibernate `ddl-auto: validate`
- Flyway disabled

`prod` profile:

- `TOMODACHI_DATABASE_URL`, `TOMODACHI_DATABASE_USER`, `TOMODACHI_DATABASE_PASSWORD`를 반드시 외부에서 주입한다.
- PostgreSQL driver 사용
- Hibernate `ddl-auto: validate`
- Flyway disabled

`db/init.sql`은 standalone schema mirror/seed 표면이다. 현재 Spring runtime은 Hibernate 설정을 기준으로 동작하므로 schema drift는 수동으로 확인해야 한다.
