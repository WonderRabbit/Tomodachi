# Tomodachi AWS/GCP 비용 및 보안 Runbook

**작성 기준일:** 2026-06-29 KST
**범위:** `dev`, `prod` cloud 배포 전 비용 추정, 보안 설정, 운영 점검
**원칙:** 월 비용 숫자를 문서에 고정하지 않는다. 실제 provision 전 같은 region, 같은 usage 가정, 같은 할인/무료 tier 조건으로 provider calculator와 공식 pricing page를 다시 확인한다.

## 1. 기본 판단

Tomodachi의 현재 기본 topology는 작은 단일 VM + Docker Compose다. backend, frontend, PostgreSQL을 한 VM에서 시작하고, 트래픽, 장애 대응, 백업 요구가 실제로 커진 뒤 managed DB와 managed runtime으로 분리한다.

| 구분 | AWS 기본값 | GCP 기본값 | 전환 시점 |
| --- | --- | --- | --- |
| 저비용 `dev` | Lightsail 또는 작은 EC2 1대 | Compute Engine 작은 VM 1대 | 팀 공유 검증이 필요할 때 |
| 초기 `prod` | EC2 1대 + Docker Compose, 필요 시 Lightsail | Compute Engine 1대 + Docker Compose | DNS, TLS, backup/restore, Budget alert가 준비된 뒤 |
| managed runtime 후보 | ECS/Fargate 또는 EC2 ASG | Cloud Run 또는 GKE | SSH/VM patching 부담이 운영 리스크가 될 때 |
| managed DB 후보 | RDS PostgreSQL | Cloud SQL for PostgreSQL | RPO/RTO, 자동 백업, point-in-time recovery가 비용보다 중요해질 때 |

Cost gate:

1. `dev`와 `prod` 각각 region을 먼저 정한다.
2. instance, disk, snapshot, static IP 또는 external IPv4, DNS hosted zone, data transfer/egress, log 보관, managed secret, managed DB 후보를 같은 region 기준으로 산정한다.
3. 계산 결과는 issue 또는 배포 승인 문서에 붙이고, 이 runbook에는 account-specific 가격을 쓰지 않는다.
4. 첫 리소스 생성 전 AWS Budgets 또는 GCP Billing budgets를 만든다.
5. Budget alert가 동작하기 전에는 `prod`를 공개하지 않는다.

## 2. 공식 확인 링크

가격과 보안 동작은 자주 바뀐다. 아래 링크를 provisioning 직전에 다시 확인한다.

| 항목 | 공식 링크 |
| --- | --- |
| AWS Lightsail pricing | https://aws.amazon.com/lightsail/pricing/ |
| AWS EC2 On-Demand pricing | https://aws.amazon.com/ec2/pricing/on-demand/ |
| AWS RDS for PostgreSQL pricing | https://aws.amazon.com/rds/postgresql/pricing/ |
| AWS Route 53 pricing | https://aws.amazon.com/route53/pricing/ |
| AWS Certificate Manager pricing | https://aws.amazon.com/certificate-manager/pricing/ |
| AWS Systems Manager pricing | https://aws.amazon.com/systems-manager/pricing/ |
| AWS Secrets Manager pricing | https://aws.amazon.com/secrets-manager/pricing/ |
| AWS Budgets pricing | https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/ |
| AWS Budgets guide | https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html |
| AWS Parameter Store guide | https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html |
| AWS Secrets Manager guide | https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html |
| AWS ACM renewal guide | https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html |
| AWS EBS snapshot guide | https://docs.aws.amazon.com/ebs/latest/userguide/ebs-snapshots.html |
| GCP Compute Engine pricing | https://cloud.google.com/compute/vm-instance-pricing |
| GCP Cloud Run pricing | https://cloud.google.com/run/pricing |
| GCP Cloud SQL pricing | https://cloud.google.com/sql/pricing |
| GCP Cloud DNS pricing | https://cloud.google.com/dns/pricing |
| GCP Secret Manager pricing | https://cloud.google.com/secret-manager/pricing |
| GCP external IPv4/network pricing | https://cloud.google.com/vpc/network-pricing |
| GCP Billing budgets guide | https://cloud.google.com/billing/docs/how-to/budgets |
| GCP Compute Engine snapshot guide | https://cloud.google.com/compute/docs/disks/create-snapshots |
| GCP Workload Identity Federation guide | https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines |
| GitHub Environment deployment guide | https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment |
| GitHub Actions secrets guide | https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets |
| GitHub OIDC guide | https://docs.github.com/en/actions/concepts/security/openid-connect |

## 3. AWS runbook

### 3.1 선택지

Lightsail:

- `dev` 또는 아주 작은 `prod`에서 가장 단순한 시작점이다.
- instance bundle에 compute, disk, transfer allowance가 묶여 있어 예산 설명이 쉽다.
- public IPv4, snapshot, static IP 미사용 상태, 초과 transfer, managed database bundle, DNS 사용 여부를 별도로 확인한다.
- 장기 운영에서 VPC, IAM, RDS, ACM, ALB 같은 AWS 표준 구성으로 갈 가능성이 크면 처음부터 EC2를 택하는 편이 이관 비용을 줄인다.

EC2:

- GitHub Actions + GHCR + SSH/Compose 기본 추천안과 잘 맞는다.
- instance type, EBS volume, Elastic IP, snapshot, data transfer, CloudWatch log/metric 보관을 따로 산정해야 한다.
- security group은 `22/tcp`를 운영자 IP 또는 bastion/VPN으로 제한하고, `80/tcp`, `443/tcp`만 공개한다.
- Docker/Compose, OS patching, disk 용량, backup job은 운영자가 직접 관리한다.

RDS PostgreSQL migration point:

- 단일 VM PostgreSQL backup/restore가 운영 리스크가 되거나, RPO/RTO가 명시되면 RDS PostgreSQL을 검토한다.
- migration 전 `db/init.sql`과 실제 Hibernate schema validate 결과가 맞는지 확인한다.
- RDS 비용은 instance, storage, backup retention, Multi-AZ, data transfer, snapshot export, monitoring을 함께 산정한다.
- cutover 전에는 VM DB에서 `pg_dump`를 만들고 RDS staging restore rehearsal을 통과해야 한다.

### 3.2 AWS hidden costs

Provision 전 체크:

- Lightsail bundle 또는 EC2 instance hourly/on-demand 비용
- EBS root/data volume 용량과 IOPS 설정
- EBS snapshot 또는 Lightsail snapshot 보관
- Elastic IP 또는 static IP가 detached/idle 상태일 때의 과금 가능성
- public IPv4 사용 비용
- outbound data transfer/egress와 region별 transfer allowance 차이
- Route 53 hosted zone, DNS query, domain registration/renewal
- ACM public certificate 자체와 연결되는 ALB/CloudFront/API Gateway 같은 주변 리소스 비용
- Parameter Store Advanced parameter 또는 Secrets Manager secret/API call 비용
- RDS PostgreSQL, backup retention, snapshot, monitoring 비용
- CloudWatch logs/metrics retention

### 3.3 AWS security setup

Identity:

- root account는 MFA를 켜고 일상 작업에 쓰지 않는다.
- 운영자는 개인 IAM Identity Center 또는 최소 권한 IAM role을 쓴다.
- GitHub Actions가 cloud-native deploy를 수행하는 경우 장기 access key 대신 GitHub OIDC + AWS IAM role을 우선한다.
- SSH/Compose VM deploy만 쓰는 경우 cloud API 권한은 배포 workflow에 넣지 않는다.

Secrets:

- VM Compose path의 application secret은 GitHub Environment Secrets 또는 서버의 root-owned env file 중 하나로 주입한다.
- AWS-native path에서는 Parameter Store를 기본 후보로 두고, 자동 rotation 또는 cross-service credential lifecycle이 필요하면 Secrets Manager를 선택한다.
- secret 이름은 환경을 포함한다. 예: `/tomodachi/dev/database-url`, `/tomodachi/prod/database-password`
- secret value는 문서, issue, workflow log, Docker image layer에 쓰지 않는다.

Network:

- security group inbound는 `80/tcp`, `443/tcp`, 제한된 `22/tcp`만 허용한다.
- PostgreSQL `5432/tcp`는 public internet에 열지 않는다.
- SSH 접속 user는 `deploy` 같은 전용 계정으로 제한하고 `sudo` 권한은 필요한 명령만 허용한다.

TLS:

- VM 단독 배포는 Caddy 또는 nginx + certbot 중 하나로 통일한다.
- ALB/CloudFront 등 managed endpoint를 쓰면 ACM을 사용하고 DNS validation record 소유자를 문서화한다.
- ACM managed renewal은 DNS validation record가 유지되어야 정상 동작한다. record 삭제나 zone 이전 전 갱신 상태를 확인한다.

## 4. GCP runbook

### 4.1 선택지

Compute Engine:

- `dev`와 초기 `prod`의 기본값이다.
- 작은 VM 1대에 Docker/Compose를 올리고 GHCR image를 pull한다.
- machine type, boot disk, persistent disk snapshot, external IPv4, egress, Cloud Logging 보관을 따로 산정한다.
- firewall rule은 `22/tcp`를 운영자 IP 또는 IAP/VPN으로 제한하고, `80/tcp`, `443/tcp`만 공개한다.

Cloud Run:

- container 기반 managed runtime 후보로 남긴다.
- request 기반 scaling, revision, IAM, Secret Manager 연동이 장점이다.
- PostgreSQL은 Cloud SQL 또는 외부 DB와 연결해야 하므로 connector/network 비용과 cold start/connection pooling을 함께 검토한다.
- Cloud Run으로 전환하면 GitHub Actions는 OIDC를 통해 Google Cloud Workload Identity Federation을 쓰는 방향을 우선한다.

Cloud SQL migration point:

- 운영 DB backup/restore와 patching을 직접 관리하기 어렵거나, point-in-time recovery가 필요하면 Cloud SQL for PostgreSQL을 검토한다.
- 비용은 instance, storage, backup, high availability, network egress, connector 사용을 함께 산정한다.
- cutover 전에는 Compute Engine PostgreSQL에서 `pg_dump`를 만들고 Cloud SQL staging restore rehearsal을 통과해야 한다.

### 4.2 GCP hidden costs

Provision 전 체크:

- Compute Engine machine type과 region/zone
- boot disk, persistent disk, snapshot schedule과 snapshot storage
- external IPv4 address 사용 및 idle 상태
- outbound data transfer/egress
- Cloud DNS managed zone과 DNS query
- domain registration/renewal을 Google Domains 대체 registrar 또는 외부 registrar에서 관리하는지 여부
- Secret Manager secret version 및 access operation 비용
- Cloud SQL instance, storage, backup, HA, network 비용
- Cloud Run CPU/memory/request/network 비용
- Cloud Logging retention과 log volume

### 4.3 GCP security setup

Identity:

- billing admin, project owner, deployer role을 분리한다.
- GitHub Actions가 managed cloud deploy를 수행하면 long-lived JSON key 대신 Workload Identity Federation + service account impersonation을 우선한다.
- VM SSH deploy만 쓰는 경우 GitHub workflow에는 VM 접속 secret만 두고 broad project admin 권한을 주지 않는다.

Secrets:

- GCP-native path에서는 Secret Manager를 기본으로 둔다.
- environment별 secret을 분리한다. 예: `tomodachi-dev-database-url`, `tomodachi-prod-database-password`
- secret version 교체일과 rollback 가능한 이전 version 보관 정책을 운영 기록에 남긴다.
- service account JSON key file은 만들지 않는 것을 기본값으로 한다. 예외가 있으면 만료일, 보관 위치, 폐기 일정을 승인 문서에 쓴다.

Network:

- firewall rule은 최소 포트만 허용한다.
- PostgreSQL `5432/tcp`는 public internet에 열지 않는다.
- SSH는 OS Login, IAP TCP forwarding, 또는 제한된 source IP 중 하나로 운영한다.

TLS:

- VM 단독 배포는 Caddy 또는 nginx + certbot 중 하나로 통일한다.
- Cloud Run은 managed certificate 또는 HTTPS load balancer/Certificate Manager 조합을 검토한다.
- certificate renewal 실패를 놓치지 않도록 만료 30일 전 alert를 둔다.

## 5. Domain/DNS 운영

Domain purchase/renewal:

- registrar, domain owner, renewal email, renewal date, payment owner, 2FA 상태를 운영 문서에 기록한다.
- domain 자동 갱신이 켜져 있어도 결제 수단 만료, owner email 접근 불가, registrar account 잠금이 생기면 장애가 된다.
- domain purchase 비용과 renewal 비용은 cloud provider 비용과 별도다.

DNS ownership:

- AWS Route 53 또는 GCP Cloud DNS를 쓰면 hosted zone owner와 NS record delegation을 기록한다.
- registrar와 DNS provider가 다르면 registrar의 NS record가 실제 hosted zone을 가리키는지 확인한다.
- `dev`와 `prod` record는 분리한다. 예: `dev.tomodachi.example`, `app.tomodachi.example`
- DNS record 변경 전 현재 값, TTL, 변경자, rollback 값을 남긴다.
- `A`, `AAAA`, `CNAME`, ACM/Certificate Manager validation record는 삭제 전 소유자 확인이 필요하다.

## 6. SSH key lifecycle

Key 생성:

```bash
ssh-keygen -t ed25519 -C "tomodachi-dev-deploy-20260629" -f ~/.ssh/tomodachi_dev_deploy
ssh-keygen -t ed25519 -C "tomodachi-prod-deploy-20260629" -f ~/.ssh/tomodachi_prod_deploy
chmod 600 ~/.ssh/tomodachi_dev_deploy ~/.ssh/tomodachi_prod_deploy
```

Lifecycle:

- `dev`와 `prod` SSH key를 분리한다.
- private key는 repository, `.env`, issue, chat, CI log에 두지 않는다.
- public key만 VM의 `authorized_keys`, cloud metadata, 또는 OS Login에 등록한다.
- GitHub Actions VM deploy에서는 GitHub Environment Secrets에 환경별 private key를 넣고, 해당 environment 보호 규칙을 건다.
- key owner, 생성일, 마지막 사용일, rotation 예정일, 폐기일을 기록한다.
- 퇴사/권한 변경/노출 의심/VM 재생성 시 `authorized_keys`에서 기존 key를 제거하고 새 key로 교체한다.

Server hardening:

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo install -m 600 -o deploy -g deploy /tmp/tomodachi_dev_deploy.pub /home/deploy/.ssh/authorized_keys
```

`PasswordAuthentication no`와 `PermitRootLogin no`는 OS별 sshd 설정 위치를 확인한 뒤 적용하고, 변경 후 기존 session을 끊기 전에 새 session으로 접속을 검증한다.

## 7. GitHub Environment Secrets와 OIDC

VM SSH/Compose path:

- `dev`, `prod` GitHub Environment를 분리한다.
- `prod` environment에는 required reviewers와 branch/tag restriction을 둔다.
- Environment Secrets 예시 이름:
  - `TOMODACHI_DEPLOY_HOST`
  - `TOMODACHI_DEPLOY_USER`
  - `TOMODACHI_DEPLOY_SSH_KEY`
  - `TOMODACHI_DATABASE_URL`
  - `TOMODACHI_DATABASE_USER`
  - `TOMODACHI_DATABASE_PASSWORD`
- secret 값은 workflow output에 출력하지 않는다.
- SSH known_hosts는 `ssh-keyscan` 결과를 검증한 뒤 environment secret 또는 repository variable로 관리한다.

Cloud-native deploy path:

- AWS ECS/Fargate, RDS, Route 53, ACM, Parameter Store, Secrets Manager를 workflow가 직접 조작하면 GitHub OIDC + provider role을 우선한다.
- GCP Cloud Run, Cloud SQL, Cloud DNS, Secret Manager를 workflow가 직접 조작하면 GitHub OIDC + Workload Identity Federation을 우선한다.
- `permissions: id-token: write`는 OIDC가 필요한 job에만 둔다.
- long-lived cloud access key 또는 service account JSON key file을 GitHub Secret에 넣는 방식은 예외로 취급하고 만료일과 폐기 절차를 둔다.

## 8. TLS certificate renewal

VM Caddy:

- Caddy가 `80/tcp`, `443/tcp`에 접근할 수 있어야 HTTP-01 또는 TLS-ALPN validation이 동작한다.
- domain DNS record가 VM public IP를 가리키는지 확인한다.
- Caddy data volume을 persistent volume으로 둔다.
- renewal 실패 log를 alert 대상으로 둔다.

VM nginx + certbot:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

- `certbot renew --dry-run`을 prod 공개 전과 quarter마다 실행한다.
- renewal cron/systemd timer 상태를 확인한다.
- 인증서 만료 30일 전 alert를 둔다.

Managed certificate:

- AWS ACM, GCP managed certificate, Cloud Run domain mapping은 DNS validation record와 domain ownership이 유지되어야 한다.
- DNS provider를 옮기면 validation record를 먼저 재생성하고 certificate status를 확인한 뒤 traffic record를 옮긴다.

## 9. DB backup/restore rehearsal

단일 VM PostgreSQL 기본 backup:

```bash
mkdir -p /var/backups/tomodachi
pg_dump --format=custom --no-owner --no-acl "$TOMODACHI_DATABASE_URL" > /var/backups/tomodachi/tomodachi-$(date +%Y%m%d%H%M%S).dump
```

Restore rehearsal:

```bash
createdb tomodachi_restore_check
pg_restore --clean --if-exists --no-owner --no-acl --dbname=tomodachi_restore_check /var/backups/tomodachi/<backup-file>.dump
psql --dbname=tomodachi_restore_check -c '\dt'
dropdb tomodachi_restore_check
```

Rules:

- backup 성공만으로 완료 처리하지 않는다. restore rehearsal이 통과해야 한다.
- `dev`는 월 1회, `prod`는 배포 전과 정기 점검 때 restore rehearsal을 수행한다.
- backup 파일은 application VM disk 하나에만 두지 않는다. 최소한 별도 disk, object storage, 또는 managed snapshot 중 하나를 둔다.
- backup retention, encryption, restore owner, 삭제 owner를 기록한다.
- RDS PostgreSQL 또는 Cloud SQL로 옮기면 provider snapshot/PITR 설정과 별개로 application-level `pg_dump` rehearsal을 유지한다.

## 10. 배포 전 checklist

공통:

- [ ] region-aware cost estimate가 최신 공식 pricing/source link 기준으로 남아 있다.
- [ ] AWS Budgets 또는 GCP Billing budgets가 만들어졌고 alert 수신자가 확인되었다.
- [ ] domain registrar, DNS provider, renewal owner, DNS record owner가 기록되었다.
- [ ] `dev`와 `prod` DNS record가 분리되어 있다.
- [ ] SSH key owner, rotation date, revocation path가 기록되었다.
- [ ] GitHub Environment Secrets가 `dev`, `prod`로 분리되어 있고 `prod`에는 승인 gate가 있다.
- [ ] OIDC가 필요한 cloud-native deploy job에만 `id-token: write`가 있다.
- [ ] TLS certificate renewal 또는 managed certificate validation record가 확인되었다.
- [ ] PostgreSQL backup/restore rehearsal이 통과했다.
- [ ] repository에는 cloud key, SSH private key, production password, provider account-specific secret이 없다.

AWS:

- [ ] Lightsail 또는 EC2 중 하나를 선택했고 선택 이유를 기록했다.
- [ ] Route 53 hosted zone과 domain registration/renewal 비용을 확인했다.
- [ ] ACM을 쓰는 경우 validation record와 renewal 조건을 확인했다.
- [ ] Parameter Store 또는 Secrets Manager 중 하나를 선택했고 비용/rotation 필요성을 확인했다.
- [ ] RDS PostgreSQL 전환 기준과 현재는 단일 VM PostgreSQL을 유지하는 이유를 기록했다.
- [ ] snapshot, Elastic IP, public IPv4, egress, CloudWatch hidden costs를 산정했다.

GCP:

- [ ] Compute Engine을 기본값으로 선택했거나 Cloud Run 선택 이유를 기록했다.
- [ ] Cloud DNS managed zone과 domain registration/renewal 책임을 확인했다.
- [ ] Secret Manager 비용과 secret version 정책을 확인했다.
- [ ] Cloud SQL 전환 기준과 현재는 단일 VM PostgreSQL을 유지하는 이유를 기록했다.
- [ ] snapshot, external IPv4, egress, Cloud Logging hidden costs를 산정했다.
