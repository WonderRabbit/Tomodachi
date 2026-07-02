# Tomodachi Compose 배포 오버레이

## 로컬

로컬 Docker 개발에서는 `deploy/docker-compose.yml`만 사용한다.

```bash
docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml --project-directory . up --build
```

로컬 구성은 Postgres, backend, frontend를 `127.0.0.1`에만 공개한다. 공개 VM 배포용 파일이 아니다.

## 개발/프로덕션 VM 오버레이

CI 작업이 GHCR 또는 다른 registry에 이미지를 게시한 뒤, 특정 provider에 묶이지 않은 cloud VM에서 오버레이 파일을 사용한다.

`docker compose config`, `pull`, `up`을 실행하기 전에 반드시 배포 env validator를 먼저 실행한다. Compose config 렌더링은 YAML/interpolation 확인일 뿐이며, 공백이 포함된 값처럼 잘못된 image tag도 렌더링될 수 있다.

개발 템플릿은 smoke-test 시작점으로 바로 배포할 수 있다.

```bash
deploy/validate-compose-env.sh --env-file deploy/env.dev.template
docker compose --env-file deploy/env.dev.template -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml --project-directory . pull
docker compose --env-file deploy/env.dev.template -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml --project-directory . up -d
```

프로덕션 템플릿은 의도적으로 배포할 수 없다. 필수 secret sentinel과 `example.com` domain/email placeholder가 들어 있으므로, 복사해서 실제 값으로 채우기 전까지 `deploy/validate-compose-env.sh --env-file deploy/env.prod.template`은 실패해야 한다.

프로덕션 VM에서는 VM-local env 파일을 만들고 commit하지 않는다.

```bash
cp deploy/env.prod.template .env.prod
vi .env.prod
```

`.env.prod`에서 모든 `__REQUIRED_PROD_SECRET__`, password placeholder, `TOMODACHI_DOMAIN`, `TOMODACHI_TLS_EMAIL` 값을 교체한다. 도메인은 VM을 가리켜야 하고, TLS email은 `example.com` placeholder가 아닌 실제 운영자 email이어야 한다.

VM-local env 파일로 프로덕션을 검증하고 배포한다.

```bash
deploy/validate-compose-env.sh --env-file .env.prod
docker compose --env-file .env.prod -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml --project-directory . pull
docker compose --env-file .env.prod -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml --project-directory . up -d
```

오버레이 동작:

- `SPRING_PROFILES_ACTIVE=dev` 또는 `SPRING_PROFILES_ACTIVE=prod`를 설정한다.
- backend와 frontend는 `TOMODACHI_BACKEND_IMAGE`, `TOMODACHI_FRONTEND_IMAGE`, `TOMODACHI_IMAGE_TAG`에서 실행한다.
- `db`, `backend`, `frontend`의 직접 port publishing을 제거한다.
- `TOMODACHI_PUBLIC_HTTP_BIND`, `TOMODACHI_PUBLIC_HTTPS_BIND`의 Caddy만 외부에 공개한다.
- PostgreSQL은 Compose network 내부에 두고 `TOMODACHI_DB_VOLUME`에 영속화한다.
- Caddy TLS 상태는 named volume에 보관해 container 교체 후에도 certificate가 유지되게 한다.
- 선택형 `backup` profile은 `pg_dump -Fc` archive를 `TOMODACHI_BACKUP_VOLUME`에 쓴다.

공개 VM에서는 `TOMODACHI_DOMAIN` DNS가 VM을 가리켜야 하며, firewall/security-group 경계에서 80/443 port가 열려 있어야 한다. TLS는 Caddy에서 종료한다. Backend는 Caddy의 `/api/*` routing boundary와 외부 health check용 `/actuator/health`를 통해서만 public internet에 노출된다. 정확한 `/actuator`와 그 밖의 `/actuator/*` path는 Caddy가 `404`로 응답한다.

수동 backup 실행:

```bash
docker compose --env-file .env.prod -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml --project-directory . --profile backup run --rm db-backup
```

복구는 의도적으로 수동 절차다. 선택한 dump를 `TOMODACHI_BACKUP_VOLUME`에서 복사하고, app traffic을 멈춘 뒤, 새 PostgreSQL volume에 `pg_restore`로 복구하고 stack을 다시 시작한다. 프로덕션 volume을 교체하기 전에 복구된 DB를 검증한다.
