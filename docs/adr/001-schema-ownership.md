# ADR 001: 데이터베이스 스키마 소유권과 패리티 검증

- 상태: 승인됨
- 결정일: 2026-07-12
- 적용 범위: PostgreSQL 배포 스키마, Spring Data JPA 매핑, 로컬 pre-merge 검증

## 배경

현재 런타임은 기본 프로필에서 H2와 Hibernate `ddl-auto=update`를 사용하지만, `dev`와 `prod` 프로필은 PostgreSQL과 `ddl-auto=validate`를 사용한다. 배포용 테이블, 제약 조건, 인덱스는 `db/init.sql`에 선언되어 있다. 이 두 표면의 책임을 구분하지 않으면 H2에서 통과한 변경이 PostgreSQL 배포 시점에 실패하거나, JPA가 사용하지 않는 인덱스가 조용히 사라질 수 있다.

## 결정

1. `db/init.sql`을 현재 PostgreSQL 배포 스키마의 권위 있는 소스로 유지한다.
2. JPA 엔티티는 스키마 생성 소스가 아니라 `dev`/`prod`의 `ddl-auto=validate` 검증 대상이다.
3. `scripts/verify-schema-parity.sh`는 빈 일회용 PostgreSQL에 `db/init.sql`을 적용하고, 백엔드를 `dev` 프로필로 기동해 JPA 검증을 통과시킨 뒤, `pg_catalog`의 테이블과 인덱스를 체크인된 fixture와 비교한다.
4. Flyway 전환은 migration baseline, 롤백, 운영 적용 순서를 별도로 승인받아야 하므로 이번 결정에서 보류한다. 현재 `spring.flyway.enabled=false`를 바꾸지 않는다.

## 검증 계약

- Docker 클라이언트와 데몬이 모두 사용 가능해야 한다. 데몬을 사용할 수 없으면 결과는 성공이 아니라 `ENVIRONMENT_BLOCKED`다.
- 검증기는 고유 컨테이너 이름, Docker가 배정한 임의 loopback host port, 고유 임시 디렉터리를 사용한다.
- 백엔드는 `SPRING_PROFILES_ACTIVE=dev`, 생성된 datasource 환경 변수, `SERVER_PORT=0`으로 실행하며 `Started TomodachiBackendApplication` 로그를 정확히 확인한다.
- 정상 종료, 오류, 신호 모두에서 Gradle 프로세스, 컨테이너, 임시 디렉터리를 정리한다.
- fixture는 실행하지 않고 JSON 데이터로만 파싱한다.
- fixture는 저장소 내부의 일반 파일만 허용하며 symlink나 저장소 밖 경로를 거부한다.
- 컨테이너는 난수 ownership label과 생성 직후의 ID/name/label 일치가 모두 확인된 경우에만 소유 자원으로 등록하고 제거한다. 검증되지 않은 stdout, ID, label은 삭제하지 않고 cleanup 실패로 보고한다.
- `docker run`이 nonzero를 반환해도 출력된 candidate ID 또는 고유 생성 name으로 조회한 ID/name/label이 모두 일치하면 이 실행의 부분 생성 자원으로 회수해 정리한다. stdout이 없거나 metadata가 불일치하면 삭제하지 않는다.
- 검증기는 로컬 `postgres:16-alpine` image ID를 먼저 확인하고 기록하며 `--pull=never`로 실행한다. 로컬 이미지가 없으면 네트워크 pull로 강등하지 않고 `ENVIRONMENT_BLOCKED`다.
- 임시 DB 비밀번호는 실행별 128-bit ownership token에서 만든다. fixture는 owned tempdir에 `cp -P`로 먼저 캡처하고 원본 canonical 경로와 snapshot의 regular/non-symlink 상태를 재검증한 뒤, snapshot만 파싱·비교한다.
- 백엔드는 Linux의 `setsid` 또는 macOS의 Perl `POSIX::setsid`로 격리한 process group에서 시작한다. 종료 시 group 전체에 TERM을 보내고 제한 시간 뒤 KILL하며 잔존 여부를 확인한다. 두 launcher가 모두 없으면 PID-only 정리로 강등하지 않고 `ENVIRONMENT_BLOCKED`로 중단한다.

## 결과와 한계

이 결정은 배포 SQL과 ORM 매핑의 드리프트를 조기에 차단하고, JPA가 검증하지 않는 인덱스 누락도 탐지한다. 반면 PostgreSQL 제약 조건의 의미 전체와 데이터 migration 호환성은 이 가드의 범위가 아니다. 제약 조건 변경은 `db/init.sql`, Kotlin enum/API 계약을 함께 검토해야 하며, Flyway 도입 시에는 별도 ADR과 migration 검증을 추가한다.

## 차선책

Docker를 사용할 수 없는 환경에서는 `cd backend && ./gradlew test`와 스크립트의 정적/입력 검증만 수행할 수 있다. 이는 H2 기반 회귀 검증일 뿐 PostgreSQL 패리티의 대체 증거가 아니며, Docker가 가능한 환경에서 본 가드를 다시 실행해야 한다.
