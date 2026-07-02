# Tomodachi 배포 Step by Step 가이드

**작성 기준일:** 2026-06-25 KST

이 문서는 Tomodachi MVP를 네 가지 환경에 배포하기 위한 상세 절차다.

1. Windows PowerShell 7.6: `winget`과 Docker를 쓰지 않는 native 설치/실행
2. macOS zsh: 제한 없이 Docker Desktop/Compose 사용
3. AWS: 비용을 최우선으로 한 Lightsail 중심 배포
4. GCP: 비용을 최우선으로 한 Compute Engine 중심 배포

기존 [deployment-one-command.md](./deployment-one-command.md)는 Docker Compose wrapper 중심의 로컬 배포 문서다. 이 문서는 그보다 넓은 운영 runbook이며, 특히 Windows에서는 Docker를 쓰지 않는다는 전제가 다르다.

## 빠른 결론

| 경로 | 추천도 | 비용 판단 방식 | 핵심 판단 |
| --- | --- | --- | --- |
| Windows PowerShell 7.6 native | 내부 PC/서버 검증용 | 추가 cloud 인프라 없이 검증 | Docker가 금지된 환경에서 수동 설치로 실행한다. 자동 시작은 Task Scheduler 또는 service wrapper가 필요하다. |
| macOS zsh local Docker | 로컬 운영/데모용 | Docker Desktop 라이선스 조건 확인 | 현재 저장소의 `scripts/deploy.sh`와 가장 잘 맞는다. 기본 포트 바인딩은 `127.0.0.1` 로컬 전용이다. |
| AWS Lightsail single VM | 최저비용 cloud 1순위 | 공식 pricing/calculator 재계산 필수 | 작은 MVP는 Lightsail 단일 Linux VM + Docker Compose가 가장 단순하다. DB 분리는 비용을 크게 올린다. |
| GCP Compute Engine single VM | 최저비용 cloud 2순위 | 공식 pricing/calculator 재계산 필수 | Always Free 조건을 먼저 확인하되, 외부 IPv4, disk, backup, log 비용을 반드시 감시한다. |

AWS/GCP 비용은 리전, 무료 티어, IPv4, 디스크, 백업, 로그, 데이터 전송에 따라 바뀐다. 이 문서에는 고정 월 비용을 두지 않으며, 최종 배포 전에는 반드시 [cloud-cost-security-runbook.md](./cloud-cost-security-runbook.md)의 원칙에 따라 provider calculator와 공식 pricing page를 같은 리전 기준으로 다시 확인한다.

## 공통 원칙

### Runtime 구성

Tomodachi 배포는 다음 구성요소를 필요로 한다.

| 구성요소 | 현재 저장소 기준 |
| --- | --- |
| Backend | Kotlin 2.2.21, Spring Boot 3.5.9, Java 21 |
| Frontend | React 19, Vite 6, TypeScript |
| Database | PostgreSQL compatible schema, `db/init.sql` |
| Local Docker stack | `deploy/docker-compose.yml` |
| Backend 배포 profile | `SPRING_PROFILES_ACTIVE=dev` 또는 `SPRING_PROFILES_ACTIVE=prod`, PostgreSQL JDBC env |

`dev`와 `prod` profile은 `spring.jpa.hibernate.ddl-auto=validate`를 사용한다. 따라서 PostgreSQL에는 먼저 `db/init.sql` schema가 적용되어 있어야 한다.

### Secret 관리

절대로 commit하지 않는 값:

- `POSTGRES_PASSWORD`
- `TOMODACHI_DATABASE_PASSWORD`
- JWT/token/API key
- cloud access key
- private SSH key
- provider service account key JSON

로컬에서는 `deploy/.env` 또는 OS-level secret store를 사용한다. cloud에서는 provider secret manager를 우선한다.

| 환경 | 권장 secret 저장소 |
| --- | --- |
| Windows native | `%USERPROFILE%\.tomodachi\tomodachi.env`, `pgpass.conf`, Windows Credential Manager 검토 |
| macOS local | `deploy/.env`, `chmod 600`, macOS Keychain 검토 |
| AWS | 비용 우선: SSM Parameter Store Standard. Rotation 필요 시 Secrets Manager |
| GCP | Secret Manager. 작은 MVP는 free allowance 안에서 시작 가능 |

### Domain, SSH, API key 보안 묶음

운영 표준은 다음 세트를 하나로 관리하는 것이다.

| 항목 | 관리 규칙 |
| --- | --- |
| Domain | registrar, DNS hosted zone, renewal date, owner email, 2FA 상태를 기록한다. |
| DNS | A/AAAA/CNAME record와 TTL 변경 이력을 기록한다. |
| SSH | private key는 로컬 사용자만 읽게 하고, cloud 콘솔/metadata에는 public key만 둔다. |
| API key | `.env`, shell history, CI log, Dockerfile `ARG`/`ENV`에 남기지 않는다. |
| TLS | 인증서 발급자, 갱신 방식, 만료 알림을 기록한다. |
| Budget | cloud project/account 생성 당일 budget alert를 만든다. |

권장 파일 위치:

```text
docs/deployment-step-by-step.md       # 공개 가능한 절차
deploy/.env.example                   # placeholder만
deploy/.env                           # 로컬 비밀값, git ignore
~/.ssh/tomodachi_<provider>           # private SSH key
~/.tomodachi/tomodachi.env            # Windows/macOS native secret env
```

## 1. Windows PowerShell 7.6 native

### 전제

이 경로는 `winget`과 Docker를 쓰지 않는다. 따라서 `scripts/deploy.ps1 up`도 사용하지 않는다. 해당 wrapper는 Docker Compose를 호출하도록 설계되어 있기 때문이다.

Windows native 경로는 다음 방식으로 실행한다.

1. PowerShell 7.6을 MSI 또는 ZIP으로 수동 설치한다.
2. JDK 21을 수동 설치한다.
3. Node.js LTS를 수동 설치한다.
4. PostgreSQL Windows installer로 PostgreSQL을 설치한다.
5. `db/init.sql`을 `psql`로 적용한다.
6. backend `bootJar`를 빌드하고 `java -jar`로 실행한다.
7. frontend를 빌드하고 `npm run preview` 또는 별도 정적 서버로 실행한다.

### 1.1 PowerShell 7.6 설치

공식 Microsoft Learn은 Windows에서 PowerShell 7이 Windows PowerShell 5.1을 대체하지 않고 side-by-side로 설치된다고 설명한다. `winget`이 금지된 환경에서는 MSI 또는 ZIP 설치를 사용한다.

공식 문서:

- https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.6
- https://github.com/PowerShell/PowerShell/releases

MSI 설치:

```powershell
msiexec.exe /package .\PowerShell-7.6.3-win-x64.msi /quiet ADD_PATH=1 ENABLE_MU=1 USE_MU=1
```

ZIP 설치:

```powershell
Expand-Archive .\PowerShell-7.6.3-win-x64.zip -DestinationPath "C:\Tools\PowerShell\7"
$env:Path = "C:\Tools\PowerShell\7;$env:Path"
pwsh.exe -NoLogo -Command '$PSVersionTable.PSVersion'
```

검증:

```powershell
pwsh -NoLogo -Command '$PSVersionTable.PSVersion'
```

### 1.2 JDK 21 설치

Tomodachi backend는 Java 21 toolchain 기준이다. Eclipse Temurin Windows MSI는 `PATH`와 `JAVA_HOME`을 설정하는 feature를 제공한다.

공식 문서:

- https://adoptium.net/installation/windows

무인 설치 예:

```powershell
msiexec /i .\OpenJDK21U-jdk_x64_windows_hotspot.msi `
  ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome `
  INSTALLDIR="C:\Program Files\Temurin\" `
  /quiet
```

검증:

```powershell
java -version
$env:JAVA_HOME
```

### 1.3 Node.js LTS 설치

frontend build에는 Node.js와 npm이 필요하다. 운영 배포는 Current보다 LTS를 우선한다.

공식 문서:

- https://nodejs.org/en/download
- https://nodejs.org/en/about/previous-releases

MSI 설치 후 검증:

```powershell
node -v
npm -v
```

### 1.4 PostgreSQL 설치

PostgreSQL 공식 Windows 다운로드 페이지는 EDB가 인증한 Windows installer를 제공한다.

공식 문서:

- https://www.postgresql.org/download/windows/

설치 시 기록할 값:

| 항목 | 예시 |
| --- | --- |
| PostgreSQL version | `17` |
| Port | `5432` |
| Superuser | `postgres` |
| Application DB | `tomodachi` |
| Application user | `tomodachi` |
| Data directory | 설치 화면에서 지정한 경로 |

설치 후 `psql` 경로가 PATH에 없다면 현재 세션에 추가한다.

```powershell
$env:Path = "C:\Program Files\PostgreSQL\17\bin;$env:Path"
psql --version
```

### 1.5 DB 생성과 schema 적용

관리자 계정으로 database와 user를 만든다.

```powershell
psql -U postgres -h 127.0.0.1 -p 5432
```

`psql` 안에서 실행:

```sql
CREATE DATABASE tomodachi;
CREATE USER tomodachi WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE tomodachi TO tomodachi;
\q
```

schema 적용:

```powershell
psql -U tomodachi -h 127.0.0.1 -p 5432 -d tomodachi -f .\db\init.sql
```

테이블 수 확인:

```powershell
psql -U tomodachi -h 127.0.0.1 -p 5432 -d tomodachi -c "\dt"
```

### 1.6 secret env 파일 작성

Windows native에서는 repo 안의 `.env`보다 사용자 홈 아래 파일을 권장한다.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.tomodachi" | Out-Null
@"
SPRING_PROFILES_ACTIVE=dev
TOMODACHI_DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/tomodachi
TOMODACHI_DATABASE_USER=tomodachi
TOMODACHI_DATABASE_PASSWORD=CHANGE_ME_STRONG_PASSWORD
"@ | Set-Content "$env:USERPROFILE\.tomodachi\tomodachi.env" -NoNewline
```

PowerShell에서 읽기:

```powershell
Get-Content "$env:USERPROFILE\.tomodachi\tomodachi.env" | ForEach-Object {
  if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
  $name, $value = $_ -split "=", 2
  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}
```

PostgreSQL CLI용 비밀번호는 `PGPASSWORD`보다 `pgpass.conf`를 우선한다.

공식 문서:

- https://www.postgresql.org/docs/current/libpq-pgpass.html
- https://www.postgresql.org/docs/current/libpq-envars.html

Windows `pgpass.conf` 위치:

```text
%APPDATA%\postgresql\pgpass.conf
```

내용 형식:

```text
127.0.0.1:5432:tomodachi:tomodachi:CHANGE_ME_STRONG_PASSWORD
```

### 1.7 backend build/run

```powershell
cd backend
.\gradlew.bat bootJar
cd ..

java -jar .\backend\build\libs\backend-0.1.0-SNAPSHOT.jar
```

다른 PowerShell 창에서 확인:

```powershell
Invoke-WebRequest http://127.0.0.1:8080/actuator/health -UseBasicParsing
```

### 1.8 frontend build/run

```powershell
cd front
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5173
```

확인:

```powershell
Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing
```

### 1.9 자동 시작

Spring Boot `.jar`를 Windows service로 직접 등록하는 것은 적합하지 않다. `New-Service`는 실행 파일 경로를 기대하므로, 운영 service가 필요하면 별도 wrapper를 선택한다. 단순 내부 운영이면 Task Scheduler가 더 현실적이다.

backend wrapper 예:

```powershell
@"
@echo off
set SPRING_PROFILES_ACTIVE=dev
set TOMODACHI_DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/tomodachi
set TOMODACHI_DATABASE_USER=tomodachi
set TOMODACHI_DATABASE_PASSWORD=CHANGE_ME_STRONG_PASSWORD
java -jar C:\Tomodachi\backend\build\libs\backend-0.1.0-SNAPSHOT.jar
"@ | Set-Content C:\Tomodachi\run-backend.cmd
```

Task Scheduler 등록:

```powershell
$action = New-ScheduledTaskAction -Execute "C:\Tomodachi\run-backend.cmd"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "TomodachiBackend" -Action $action -Trigger $trigger -RunLevel Highest
```

### 1.10 Windows 보안 checklist

- PostgreSQL `listen_addresses`는 기본적으로 localhost 유지.
- 외부 접속이 필요할 때만 `pg_hba.conf`와 firewall을 함께 변경.
- DB port `5432`는 인터넷에 직접 열지 않는다.
- `.env`, `pgpass.conf`, SSH private key는 git에 추가하지 않는다.
- PowerShell command history에 API key를 직접 입력하지 않는다.
- 자동 시작 wrapper에 secret을 넣는 경우 ACL을 제한한다.

## 2. macOS zsh local Docker

### 전제

macOS는 제한 없이 Docker Desktop과 Homebrew를 사용할 수 있다고 본다. 현재 저장소에서 가장 안정적인 경로는 기존 wrapper다.

```zsh
./scripts/deploy.sh up
```

### 2.1 도구 설치

Homebrew:

```zsh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew --version
brew doctor
```

Docker Desktop:

```zsh
brew install --cask docker
open -a Docker
docker version
docker compose version
```

공식 문서:

- https://brew.sh/
- https://docs.docker.com/desktop/setup/install/mac-install/
- https://docs.docker.com/compose/install/

Docker Desktop은 조직 규모와 사용 목적에 따라 유료 구독이 필요할 수 있다. 상업 조직에서 사용할 때는 라이선스를 확인한다.

### 2.2 env 준비

```zsh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

`deploy/.env`에서 최소 변경:

```text
POSTGRES_PASSWORD=<strong-password>
TOMODACHI_BACKEND_PORT=8080
TOMODACHI_FRONTEND_PORT=5173
```

### 2.3 사전 점검

```zsh
./scripts/deploy.sh doctor
./scripts/deploy.sh config
```

### 2.4 배포

```zsh
./scripts/deploy.sh up
```

이 명령은 다음을 수행한다.

1. Docker daemon과 Compose plugin 확인
2. PostgreSQL container 시작
3. `db/init.sql`을 empty volume 최초 기동 시 적용
4. backend image build/run
5. frontend image build/run
6. backend health 응답 대기

### 2.5 상태 확인

```zsh
./scripts/deploy.sh status
curl -i http://127.0.0.1:8080/actuator/health
open http://127.0.0.1:5173
```

login smoke:

```zsh
curl -i -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tomodachi.local","password":"password"}'
```

### 2.6 DB reset

```zsh
./scripts/deploy.sh reset-db
```

주의: 이 명령은 Docker volume을 삭제한다. 로컬 DB 내용은 사라진다.

### 2.7 localhost와 외부 공개

현재 `deploy/docker-compose.yml`은 backend/frontend/db port를 `127.0.0.1`에만 bind한다. 이는 안전한 기본값이다.

외부 공개가 필요하면 macOS local을 production처럼 쓰지 말고 cloud 배포로 이동한다. 임시 공유만 필요하면 Cloudflare Tunnel 또는 ngrok 같은 outbound tunnel을 검토한다.

### 2.8 macOS 보안 checklist

- `deploy/.env`는 `chmod 600` 유지.
- Dockerfile에 API key를 `ARG`/`ENV`로 넣지 않는다.
- `docker compose logs`에 secret이 찍히지 않게 application logging을 점검한다.
- 개인 Mac에서 cloud provider long-lived key를 저장하지 말고 SSO/short-lived credential을 우선한다.

## 3. AWS 비용 우선 배포

### 3.1 추천 architecture

최저비용 기본안:

```text
Route 53 domain/DNS
        |
Lightsail static IP
        |
Lightsail Linux VM
        |
Docker Engine + Docker Compose
        |
PostgreSQL container + backend container + frontend/nginx container
```

이 방식은 DB까지 한 VM 안에서 운영한다. 가장 싸지만, 백업과 장애 대응을 직접 책임진다.

관리 부담을 줄이는 대안:

```text
Lightsail Linux VM + Lightsail Managed Database
```

AWS 표준 확장 대안:

```text
EC2 + RDS PostgreSQL + Route 53 + ACM
```

이 대안은 비용이 올라간다. MVP 초기에는 먼저 Lightsail로 시작하고 실제 트래픽/운영 필요가 확인되면 RDS로 옮기는 편이 보수적이다.

### 3.2 비용 기준

AWS 비용은 [cloud-cost-security-runbook.md](./cloud-cost-security-runbook.md)를 기준으로 provisioning 직전에 공식 pricing page와 calculator에서 다시 계산한다. 같은 Lightsail/EC2/RDS 구성이라도 region, storage, public IPv4, snapshot, backup retention, data transfer, DNS, secret 사용량에 따라 달라진다.

| 항목 | 비용 메모 |
| --- | --- |
| Lightsail Linux public IPv4 bundle | public IPv4 포함 여부, region, storage, transfer 조건을 pricing page에서 확인 |
| Lightsail Managed DB | 단일 VM보다 비용 바닥이 올라가므로 백업/RPO 요구가 생긴 뒤 검토 |
| Route 53 hosted zone | domain registration과 별도로 monthly hosted zone fee |
| ACM public certificate | certificate 자체는 추가 비용 없음 |
| AWS Secrets Manager | secret 개수, rotation, API call에 따라 비용 증가 |
| SSM Parameter Store Standard | 작은 MVP secret에는 비용 우선 기본안 |
| Snapshot/backup | GB-month 단위로 누적 |

공식 문서:

- https://aws.amazon.com/lightsail/pricing/
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html
- https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html
- https://aws.amazon.com/route53/pricing/
- https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html
- https://aws.amazon.com/secrets-manager/pricing/
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html

### 3.3 AWS 계정 첫날 설정

1. Root user에는 MFA를 켠다.
2. 일상 작업용 IAM Identity Center 또는 IAM user를 분리한다.
3. AWS Budgets에서 monthly cost budget을 만든다.
4. budget alert를 이메일로 받게 한다.
5. Lightsail/Route 53/SSM Parameter Store만 최소 권한으로 접근하게 한다.

Budget alert는 고정 금액을 문서에서 복사하지 말고, 같은 region과 같은 리소스 조합으로 계산한 첫 달 예상치에 맞춰 만든다. 계산 근거는 issue나 배포 승인 문서에 남기고, 실제 청구가 예상치를 벗어나면 alert 기준을 즉시 조정한다.

| 구성 | 첫 budget 산정 기준 |
| --- | --- |
| Lightsail single VM | bundle, static IP, snapshot, data transfer, Route 53 hosted zone 포함 |
| Lightsail + managed DB | single VM 기준에 managed DB storage/backup/transfer 포함 |
| EC2 + RDS | instance, EBS, RDS storage/backup, public IPv4, DNS, log/monitoring 포함 |

### 3.4 Domain 구매와 DNS

Route 53에서 domain을 등록하면 hosted zone이 자동 생성될 수 있고, hosted zone monthly fee와 domain annual fee가 별도다.

절차:

1. Route 53에서 domain 검색/구매 또는 외부 registrar 사용 결정.
2. Hosted zone 생성.
3. Lightsail static IP 생성 후 instance에 attach.
4. Hosted zone에 `A` record 추가.
5. `www`가 필요하면 `CNAME` 또는 별도 record 추가.
6. TTL은 초기에 `300`초로 낮게 시작하고 안정화 후 올린다.

기록할 값:

```text
Domain:
Registrar:
Hosted zone id:
Name servers:
Static IP:
DNS records:
Renewal date:
Owner email:
2FA enabled:
```

### 3.5 Lightsail VM 생성

권장 시작:

- OS: Ubuntu 24.04 LTS
- Plan: 가장 작은 실사용 가능 tier부터 시작하되, CPU/RAM/storage/transfer 조건과 region 가격을 공식 pricing page에서 재확인
- Region: 사용자와 가까운 곳. 한국 사용자면 Seoul availability를 우선 검토하되 가격을 calculator에서 재확인
- IPv4 필요 여부: public domain이 필요하면 IPv4 포함 bundle이 단순

절차:

1. Lightsail instance 생성.
2. SSH key pair 다운로드 또는 기존 public key 등록.
3. Static IP 생성 후 instance에 attach.
4. Networking에서 `22`, `80`, `443`만 열고 `5432`는 열지 않는다.
5. SSH 접속.

```zsh
chmod 600 ~/.ssh/tomodachi_lightsail.pem
ssh -i ~/.ssh/tomodachi_lightsail.pem ubuntu@<STATIC_IP>
```

공식 문서:

- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-ssh-using-terminal.html
- https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html

### 3.6 Docker Engine 설치

VM 안에서 Docker Engine과 Compose plugin을 설치한다.

공식 문서:

- https://docs.docker.com/engine/install/ubuntu/
- https://docs.docker.com/compose/install/linux/

Ubuntu 예:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
```

Docker 공식 repository 절차는 문서의 최신 명령을 따른다. 설치 후:

```bash
docker version
docker compose version
sudo usermod -aG docker "$USER"
```

다시 로그인 후:

```bash
docker info
```

### 3.7 Tomodachi 배포

```bash
git clone <repo-url> ~/Tomodachi
cd ~/Tomodachi
cp deploy/env.prod.template .env.prod
chmod 600 .env.prod
```

`.env.prod`에서 template sentinel과 placeholder를 실제 운영 값으로 바꾼다. 최소 변경 항목:

```text
POSTGRES_PASSWORD=<strong-password>
TOMODACHI_DATABASE_PASSWORD=<strong-password>
TOMODACHI_DOMAIN=<prod-domain>
TOMODACHI_TLS_EMAIL=<tls-admin-email>
TOMODACHI_IMAGE_TAG=<published-image-tag>
```

운영 VM에서는 local wrapper 대신 prod overlay와 validator를 사용한다. `deploy/docker-compose.prod.yml`은 Caddy reverse proxy를 포함하고 `80/443`만 공개한다.

검증과 기동:

```bash
bash deploy/validate-compose-env.sh --env-file .env.prod
docker compose --env-file .env.prod \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  --project-directory . config
docker compose --env-file .env.prod \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  --project-directory . up -d
curl -i https://<prod-domain>/actuator/health
```

GitHub Actions로 운영 배포를 표준화할 경우에는 `Deploy Prod` workflow를 사용한다. 이 경로는 GitHub Environment secret/variable로 운영 env를 생성하고, `deploy/validate-compose-env.sh`와 prod overlay `docker compose config`를 거친 뒤 VM에서 pull/up을 실행한다.

### 3.8 TLS

가장 간단한 VM 단일 구성:

- Caddy: Let's Encrypt 자동 TLS
- nginx + certbot: 수동성이 조금 더 있음

AWS managed TLS를 쓰려면 ACM certificate는 무료지만, certificate를 붙일 Load Balancer/CloudFront 등 리소스 비용이 별도로 생길 수 있다. 비용 최우선이면 VM host reverse proxy의 자동 TLS가 보통 더 싸다.

### 3.9 AWS secret 관리

비용 최우선:

- SSM Parameter Store Standard에 `/tomodachi/prod/...` 형태로 저장
- EC2/Lightsail에서 IAM role 기반 접근이 어려운 경우, 초기에는 VM 로컬 `.env.prod`를 `chmod 600`으로 관리하고 key rotation 절차를 문서화

보안/rotation 우선:

- Secrets Manager 사용
- 비용: secret 개수와 API call에 따라 증가

권장 name:

```text
/tomodachi/prod/postgres/password
/tomodachi/prod/api/openai/key
/tomodachi/prod/session/secret
```

### 3.10 AWS 백업

단일 VM 방식은 반드시 backup runbook을 둔다.

```bash
mkdir -p ~/backups
docker compose --env-file .env.prod \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  --project-directory . \
  exec -T db pg_dump -U tomodachi -d tomodachi > ~/backups/tomodachi-$(date +%Y%m%d-%H%M%S).sql
```

추가로 Lightsail snapshot 또는 EBS snapshot 비용을 확인한다. snapshot은 GB-month 단위로 누적된다.

### 3.11 AWS 운영 checklist

- Budget alert 생성 완료.
- Domain renewal date 기록.
- Static IP가 instance에 attach되어 있는지 확인.
- SSH private key 권한 `600`.
- `22`는 가능하면 내 IP만 허용.
- `5432`는 외부 공개 금지.
- `.env.prod` 권한 `600`.
- weekly `pg_dump` 또는 snapshot schedule 설정.
- cloud 비용 dashboard를 첫 7일 매일 확인.

## 4. GCP 비용 우선 배포

### 4.1 추천 architecture

최저비용 기본안:

```text
Cloud DNS domain/DNS
        |
Compute Engine external IP
        |
Compute Engine e2-micro/e2-small VM
        |
Docker Engine + Docker Compose
        |
PostgreSQL container + backend container + frontend/nginx container
```

관리형 대안:

```text
Cloud Run backend/frontend + Cloud SQL PostgreSQL
```

Cloud Run 자체는 소규모 트래픽에서 저렴할 수 있지만 Cloud SQL이 비용 대부분을 차지한다. 비용 우선이면 먼저 단일 VM을 검토한다.

### 4.2 비용 기준

GCP 비용은 [cloud-cost-security-runbook.md](./cloud-cost-security-runbook.md)를 기준으로 provisioning 직전에 공식 pricing page와 calculator에서 다시 계산한다. Always Free 가능 여부, region, machine type, external IPv4, persistent disk, snapshot/backup, network egress, Cloud DNS, Secret Manager, Cloud SQL 사용 여부가 비용을 바꾼다.

| 항목 | 비용 메모 |
| --- | --- |
| Compute Engine e2-micro | Always Free 조건에 맞으면 VM 시간이 무료 가능 |
| External IPv4 | standard VM in-use external IP가 hourly 과금 |
| Cloud SQL small instance | instance, storage, backup, HA, network, connector 조건을 pricing page에서 함께 확인 |
| Cloud Run | request, CPU/memory, min instance, network, Cloud SQL 연결 비용을 함께 확인 |
| Cloud DNS | managed zone과 query 과금 |
| Secret Manager | free allowance 후 secret version/API call 과금 |

공식 문서:

- https://docs.cloud.google.com/compute/docs/sustained-use-discounts
- https://cloud.google.com/products/compute/pricing
- https://cloud.google.com/vpc/network-pricing
- https://cloud.google.com/sql/pricing
- https://cloud.google.com/run/pricing
- https://cloud.google.com/dns/pricing
- https://cloud.google.com/secret-manager/pricing

### 4.3 GCP project 첫날 설정

1. 새 project 생성.
2. Billing 연결.
3. Budget alert 생성.
4. Compute Engine API 활성화.
5. Cloud DNS, Secret Manager는 필요할 때만 활성화.
6. IAM은 개인 계정 owner 사용을 피하고 최소 role로 나눈다.

Budget alert는 고정 금액을 문서에서 복사하지 말고, 같은 region과 같은 리소스 조합으로 계산한 첫 달 예상치에 맞춰 만든다. 계산 근거는 issue나 배포 승인 문서에 남기고, 실제 청구가 예상치를 벗어나면 alert 기준을 즉시 조정한다.

| 구성 | 첫 budget 산정 기준 |
| --- | --- |
| e2-micro single VM | Always Free 충족 여부, external IPv4, disk, snapshot, egress 포함 |
| e2-small single VM | machine type, disk, snapshot, external IPv4, egress, Cloud DNS 포함 |
| Cloud Run + Cloud SQL | request/CPU/memory, Cloud SQL instance/storage/backup, connector/network 포함 |

### 4.4 VM 생성

권장 시작:

- Machine type: `e2-micro` if Always Free 조건 검증, 아니면 `e2-small`
- OS: Ubuntu 24.04 LTS
- Boot disk: 최소부터 시작, snapshot/backup 비용 감시
- Firewall: HTTP/HTTPS만 공개, SSH는 OS Login/IAM으로 제한

공식 문서:

- https://docs.cloud.google.com/compute/docs/create-linux-vm-instance
- https://docs.cloud.google.com/compute/docs/oslogin
- https://docs.cloud.google.com/compute/docs/instances/access-overview

OS Login 권장:

```bash
gcloud compute project-info add-metadata --metadata enable-oslogin=TRUE
```

SSH:

```bash
gcloud compute ssh tomodachi-vm --zone=<zone>
```

### 4.5 Static IP와 domain

domain이 필요하면 external IP를 안정적으로 유지해야 한다. 단, GCP external IPv4는 비용 항목이다.

절차:

1. Reserve static external IP.
2. VM에 attach.
3. Cloud DNS public zone 생성.
4. Registrar nameserver를 Cloud DNS nameserver로 변경.
5. A record를 static IP로 연결.

공식 문서:

- https://docs.cloud.google.com/vpc/docs/reserve-static-external-ip-address
- https://docs.cloud.google.com/dns/docs/zones
- https://docs.cloud.google.com/dns/docs/records
- https://cloud.google.com/dns/pricing

기록할 값:

```text
Project:
Domain:
Registrar:
Cloud DNS zone:
Static external IP:
VM zone:
Budget:
Owner:
```

### 4.6 Docker Engine 설치와 배포

GCP VM 안에서 Docker Engine과 Compose plugin을 설치한다.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
```

Docker 공식 repository 설치 절차는 최신 문서를 따른다.

```bash
docker version
docker compose version
```

Tomodachi 배포:

```bash
git clone <repo-url> ~/Tomodachi
cd ~/Tomodachi
cp deploy/env.prod.template .env.prod
chmod 600 .env.prod
vi .env.prod
bash deploy/validate-compose-env.sh --env-file .env.prod
docker compose --env-file .env.prod \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  --project-directory . config
docker compose --env-file .env.prod \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  --project-directory . up -d
curl -i https://<prod-domain>/actuator/health
```

CI 기반으로 운영 배포를 맡길 때는 GitHub Actions `Deploy Prod` workflow에 `image_tag`와 `confirm_prod=deploy-prod`를 넣어 실행한다. 이 workflow는 prod secret/variable로 env 파일을 만들고, validator와 prod overlay `docker compose config`를 통과한 bundle만 VM에 반영한다.

### 4.7 GCP Secret Manager

Secret Manager 예:

```bash
printf '%s' '<strong-password>' | \
  gcloud secrets create tomodachi-postgres-password --data-file=-
```

읽기:

```bash
gcloud secrets versions access latest --secret=tomodachi-postgres-password
```

운영 원칙:

- service account에 필요한 secret accessor role만 준다.
- secret value를 shell history에 남기지 않는다.
- rotation 일정을 정한다.

공식 문서:

- https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets
- https://docs.cloud.google.com/secret-manager/docs/access-secret-version
- https://cloud.google.com/secret-manager/pricing

### 4.8 Cloud Run + Cloud SQL 대안

다음 조건이면 Cloud Run + Cloud SQL을 검토한다.

- 서버 운영을 줄이고 싶다.
- 트래픽이 낮고 scale-to-zero 이점이 크다.
- Cloud SQL 비용을 감당할 수 있다.
- Docker image registry/build pipeline을 운영할 수 있다.

주의:

- Cloud SQL shared-core는 SLA 제외 조건이 있다.
- Cloud SQL storage, public IP, backup이 비용을 키운다.
- Cloud Run과 Cloud SQL은 같은 region으로 둔다.
- private 연결을 쓸 경우 Direct VPC egress와 connector 비용을 비교한다.

### 4.9 GCP 백업

단일 VM이면 DB dump를 먼저 표준화한다.

```bash
mkdir -p ~/backups
docker compose --env-file .env.prod \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  --project-directory . \
  exec -T db pg_dump -U tomodachi -d tomodachi > ~/backups/tomodachi-$(date +%Y%m%d-%H%M%S).sql
```

Cloud Storage에 올릴 경우 bucket storage 비용과 operation 비용을 확인한다.

### 4.10 GCP 운영 checklist

- Budget alert 생성 완료.
- External IPv4 비용 확인.
- Static IP 미사용 상태 방치 금지.
- OS Login 활성화.
- SSH metadata key 직접 관리 최소화.
- `5432` 외부 공개 금지.
- Secret Manager IAM 최소화.
- VM snapshot/Cloud Storage backup 비용 확인.
- Cloud Logging retention/volume 확인.

## 5. 보안 운영 세부 항목

### 5.1 SSH key

```zsh
ssh-keygen -t ed25519 -C "tomodachi-aws-20260625" -f ~/.ssh/tomodachi_aws
chmod 600 ~/.ssh/tomodachi_aws
```

규칙:

- private key는 개인 장비 밖으로 복사하지 않는다.
- public key만 cloud provider에 등록한다.
- key 이름에 provider/date/purpose를 넣는다.
- 퇴사/장비 교체/분실 시 key를 즉시 제거한다.

### 5.2 API key

API key inventory:

| Key | 저장소 | owner | rotation | 사용처 |
| --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | AWS Parameter Store 또는 GCP Secret Manager | 운영자 | 90일 | backend |
| `POSTGRES_PASSWORD` | provider secret 또는 local `.env` | 운영자 | 필요 시 | DB |

금지:

- Slack/메신저로 key 공유
- Dockerfile에 `ARG API_KEY`
- shell history에 raw key 입력
- GitHub Actions log에 secret 출력

### 5.3 Domain 구매

Domain 구매 전 확인:

- registrar account 2FA
- renewal auto-renew 상태
- 소유자 email
- WHOIS privacy
- nameserver 변경 권한
- hosted zone 월 비용

DNS 변경 절차:

1. TTL을 낮춘다.
2. 새 A/AAAA/CNAME record를 만든다.
3. `dig`로 전파 확인.
4. HTTPS 확인.
5. 안정화 후 TTL을 올린다.

```zsh
dig +short example.com
curl -I https://example.com
```

### 5.4 Cost guardrail

AWS:

- AWS Budgets monthly cost budget
- Free Tier alert
- Lightsail snapshot retention 제한
- unattached static IP 확인
- RDS/managed DB stop/delete 정책 확인

GCP:

- Cloud Billing budget alert
- external IP in-use/unused 확인
- disk snapshot retention 제한
- Cloud SQL public IP/backup/storage 확인
- Logging volume 확인

## 6. 최종 선택 기준

| 목표 | 선택 |
| --- | --- |
| Docker 금지 Windows 내부 서버 | Windows PowerShell native |
| 로컬에서 가장 빨리 확인 | macOS zsh + `./scripts/deploy.sh up` |
| cloud 최저비용 AWS | Lightsail single VM |
| cloud 최저비용 GCP | Compute Engine `e2-micro` single VM |
| DB 운영 부담 축소 | Lightsail Managed DB 또는 Cloud SQL |
| 장기 운영/확장성 | EC2 + RDS 또는 Cloud Run + Cloud SQL |

현재 Tomodachi MVP에는 cloud 최저비용 기준으로 `AWS Lightsail single VM` 또는 `GCP e2-micro/e2-small single VM`이 가장 현실적이다. 관리형 DB는 편하지만 비용이 바로 올라가므로, 초기에는 dump/snapshot 백업을 명확히 둔 단일 VM으로 시작하고 실제 사용량을 본 뒤 분리한다.

## 7. 참고 공식 문서

Windows:

- https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.6
- https://adoptium.net/installation/windows
- https://nodejs.org/en/download
- https://www.postgresql.org/download/windows/
- https://www.postgresql.org/docs/current/libpq-pgpass.html

macOS/Docker:

- https://brew.sh/
- https://docs.docker.com/desktop/setup/install/mac-install/
- https://docs.docker.com/compose/install/
- https://docs.docker.com/compose/how-tos/environment-variables/best-practices/
- https://docs.docker.com/compose/how-tos/use-secrets/

AWS:

- https://aws.amazon.com/lightsail/pricing/
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-ssh-using-terminal.html
- https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html
- https://aws.amazon.com/secrets-manager/pricing/
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html

GCP:

- https://docs.cloud.google.com/compute/docs/sustained-use-discounts
- https://cloud.google.com/vpc/network-pricing
- https://cloud.google.com/sql/pricing
- https://cloud.google.com/run/pricing
- https://cloud.google.com/dns/pricing
- https://cloud.google.com/secret-manager/pricing
