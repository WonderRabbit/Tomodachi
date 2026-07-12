# AGENTS 변경 승인 영수증

기준선: `plan/history/execution-baseline.json`

| path | baseline_sha256 | authorization_status | approver | proposal_path | permitted_scope |
| --- | --- | --- | --- | --- | --- |
| AGENTS.md | e7034d1f574e446b07cedeb1c7209ba3b2354c73f9edd82613fd41a9e2a99293 | pending | null | plan/history/proposals/AGENTS.md | 현재 topology와 재검증 명령을 반영한 root 안내 제안만 허용 |
| backend/AGENTS.md | 13f842e82ae45e6774bafc1f278ccab8c05df8ba1ea93f8ba3cf73c4da11dbd7 | pending | null | plan/history/proposals/backend-AGENTS.md | backend profile, API, 테스트 안내 제안만 허용 |
| front/AGENTS.md | 38bc61c002961fc4be622b8803e54223da72da64ecb8015ce177ab1524277037 | pending | null | plan/history/proposals/front-AGENTS.md | frontend runtime config, mock boundary, QA 안내 제안만 허용 |
| research/AGENTS.md | 73529c86f32a7f9cd342d2493019a9c4f6228366dc25b40a3a6f0bdda0728980 | pending | null | plan/history/proposals/research-AGENTS.md | research snapshot freshness와 승격 규칙 안내 제안만 허용 |

승인 상태가 `pending`인 동안 원본 네 파일에는 어떤 write도 허용되지 않는다. 제안은 위 `proposal_path`에만 기록한다.
