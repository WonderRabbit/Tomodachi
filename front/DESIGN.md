# Tomodachi 프론트엔드 디자인 시스템

## 제품 방향

Tomodachi는 제품, 프로젝트, 작업, 아키텍처, agent run을 운영하는 내부 도구다. 첫 화면은 마케팅 페이지가 아니라 인증된 대시보드여야 한다. UI는 사이드바 내비게이션, 압축된 상단 바, drill-down 요약 카드, table, board, 고정 detail panel을 중심으로 정보 밀도가 높고 정밀한 운영 도구처럼 느껴져야 한다.

## 시각 토큰

MVP는 shadcn 호환 CSS 변수와 로컬 component primitive를 사용한다. 화면 계약을 바꾸지 않고도 이후 생성된 `shadcn/ui` 컴포넌트로 교체할 수 있다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--bg` | `#0f1115` | 앱 배경 |
| `--panel` | `#151821` | shell panel과 card |
| `--panel-2` | `#1b1f2a` | 강조된 row와 선택 상태 |
| `--border` | `#2a3040` | 얇은 border |
| `--text` | `#f3f6fb` | 기본 텍스트 |
| `--muted` | `#9aa4b2` | 보조 텍스트 |
| `--accent` | `#62c8ff` | 주요 action과 focus |
| `--success` | `#57d68d` | 완료/정상 상태 |
| `--warning` | `#f3c969` | review/stale 상태 |
| `--danger` | `#ff6b7a` | blocked/error 상태 |

## 레이아웃

- `AppShell`: 상단 바, 좌측 사이드바, main route content, 우측 detail rail.
- 대시보드 첫 viewport: 지표 card, 작업 흐름 개요, review queue, architecture coverage.
- desktop은 3열을 사용한다. tablet은 우측 rail을 content 아래로 숨긴다. mobile은 sidebar를 접고 넓은 table 대신 card list를 사용한다.
- card는 유용한 drill-down route로 이어질 때만 interactive하게 만든다.

## 상호작용 규칙

- TanStack Router는 선택된 page, detail route, search state처럼 URL로 복원 가능한 context를 담당한다.
- TanStack Query는 향후 backend server state를 담당한다. MVP mock query도 같은 boundary를 유지해야 한다.
- Zustand는 sidebar 접힘, detail rail, command/search 열림 상태 같은 UI-local state만 담당한다.
- 프론트엔드는 OpenCode를 직접 호출하지 않는다. UI에 표시되는 agent data는 backend가 소유하고 정규화한 summary다.

## 컴포넌트 규칙

- card는 8px 이하 radius의 compact card를 사용한다.
- action button은 대응되는 아이콘이 있으면 lucide icon을 사용한다.
- table은 안정적인 row height를 유지하고 layout shift를 피해야 한다.
- empty/error/forbidden/stale 상태는 가능한 한 전체 화면을 비우지 말고 panel 단위로 처리한다.
