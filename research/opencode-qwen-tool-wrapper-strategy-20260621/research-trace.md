# Research Trace

## Phase 0

Core question:

OpenCode에서 Qwen3.6 35B급 모델을 사용할 때, `ast-grep`, `ripgrep`, `jq`, `yq`, `mdq`, `fd` 등을 모델에게 직접 "활용하라"고 지시하는 대신 wrapper와 shell recipe를 제공해 모델 부담을 줄이는 전략을 어떻게 문서화할 것인가.

Axes:

1. 로컬 선행 리서치: 기존 workspace `research/`, `docs/research/`, Tiny-Chu, Tinker.Gen 문서에서 OpenCode/Qwen/small-model/helper CLI 근거 확인.
2. OpenCode 동작 방식: custom commands, custom tools, MCP, permissions, agents, providers/models 조사.
3. CLI 후보 목록: `jq`, `yq`, `rg`, `fd`, `ast-grep`, `mdq`, `just`, `hyperfine`, `miller`, `httpie` 등 추천 근거 조사.
4. Wrapper 패턴 예시: upstream README/docs에서 shell wrapper, recipe catalog, AST rule catalog, output normalization 패턴 확인.
5. Model-context strategy: Qwen 계열 agentic coding model card와 tool-use research 기반으로 wrapper 필요성 확인.
6. 로컬 검증: 설치된 CLI로 output compression 검증.

Codebase relevant: yes  
External: yes  
Browsing: yes  
Verification likely: yes  
요청된 보고서:  하위 Markdown 문서`research/`

## Wave 1

Workers:

- 로컬 research/문서 inventory.
- OpenCode 문서와 repo 동작 방식.
- CLI 도구 추천 조사.
- OSS wrapper/recipe 패턴 조사.
- Qwen/model-context 전략 조사.
- 로컬 CLI 사용 가능 여부와 검증.

Key findings:

- 기존 `research/opencode-small-model-helper-cli/`는 typed helper tool 결론을 이미 제공한다.
- 이번 문서의 차별점은 repeated CLI pattern을 wrapper/recipe/catalog로 승격하는 구체 전략이다.
- OpenCode는 permission, custom command, custom tool, MCP, agent/model routing을 제공한다.
- `jq`, `yq`, `rg`, `fd`는 현재 로컬 설치되어 실행 검증 가능하다.
- `ast-grep`, `mdq`, `just`, `hyperfine`은 전략상 가치가 있지만 로컬에는 없다.
- `yq` official README는 Docker/Podman shell function wrapper 예시를 제공한다.
- `ast-grep` JSON mode와 outline/rule-catalog 설계는 agent-facing compact navigation primitive로 중요하다.

EXPAND marker 중복 제거:

- `mdq` source reliability.
- `ast-grep outline` and rule-catalog pattern.
- OpenCode command/custom tool/MCP 분리.
- `yq` stdin/file duality and wrapper function.
- `fd` command template and action execution caveat.
- `rg --json`, sort, multiline, PCRE2 advanced toggles.
- `just` recipe catalog and cross-shell support.
- Qwen tool/function-call 및 multi-turn 안정성 주의점.

## Expansion Wave 2

thread 한도로 추가 subagent를 만들 수 없어, 이미 수집한 공식 문서와 직접 web read를 바탕으로 orchestrator가 expansion을 종료했다.

종료된 확인 사항:

- `mdq`: `yshavit/mdq`는 선택형 Markdown query 후보로 타당하다. section, list, task, link, image, quote, code block, table, front matter용 Markdown selector를 지원한다. 다만 로컬에 설치되어 있지 않고 JSON output과 대형 문서 동작은 검증하지 못했다. 결정: P2 선택 항목이며 bootstrap 필수는 아니다.
- `ast-grep outline`: 강한 agent navigation 디자인 패턴이라는 근거가 있다. 다만 `sg` 설치 전에는 로컬 실행을 검증할 수 없다. 결정: P1로 추천하되 doctor와 fixture test를 붙인다.
- OpenCode surface split: 공식 문서는 prompt workflow용 custom command, typed local logic용 custom tool, 외부 tool용 MCP, gating용 permission을 지원한다. 결정: wrapper 전략은 custom tool을 먼저 쓰고, MCP는 cross-repo 재사용이 tool/context 비용을 정당화할 때만 사용한다.
- `yq`: 공식 문서와 로컬 검증은 강점과 syntax caveat를 모두 보여준다. 결정: Mike Farah v4로 고정하고 query expression은 wrapper catalog에 둔다.
- `fd -x`/`-X`: 유용한 upstream pattern이지만 action execution은 side effect를 만들 수 있다. 결정: 기본값은 read-only file discovery로 두고 action template은 `ask` 뒤에 둔다.

## 확장 3차 wave

2차 wave 이후 새 actionable lead는 남지 않았다. 남은 항목은 research blocker가 아니라 구현 follow-up이다:

- `ast-grep` 설치 및 검증.
- `mdq` 설치 및 검증.
- `just` 설치 및 검증.
- OpenCode custom tool prototype 구현.
- Qwen/OpenCode end-to-end replay 실행.

수렴 이유:

핵심 research question은 출처 기반 운영 규칙, P0 tool 로컬 검증, 사용 불가 tool에 대한 명시적 caveat로 답했다. 미확인 lead는 이 문서화 요청 범위를 벗어난 구현 task다.

## 검증 산출물

- `verification-log.md`
- `jq`, `yq`, `rg --json`, `fd`의 로컬 command output
- 현재 PATH 사용 가능 여부 확인

## 산출 파일

- `README.md`
- `wrapper-patterns.md`
- `cli-tool-recommendations.md`
- `opencode-integration-contract.md`
- `verification-log.md`
- `research-trace.md`
- `sources.md`
