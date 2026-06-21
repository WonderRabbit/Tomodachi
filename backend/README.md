# Tomodachi 백엔드

Tomodachi의 제품, 프로젝트, 작업 운영을 위한 Kotlin Spring Boot 백엔드 MVP다.

## 실행

```bash
./gradlew test
./gradlew bootRun
```

초기 계정의 비밀번호는 모두 `password`다.

- `viewer@tomodachi.local`
- `engineer@tomodachi.local`
- `agent@tomodachi.local`
- `admin@tomodachi.local`

MVP는 로컬 실행에서 기본값으로 H2를 사용한다. 이후 계획된 Spring/PostgreSQL 배포에 맞춰 PostgreSQL 드라이버와 런타임 호환성은 유지한다.
