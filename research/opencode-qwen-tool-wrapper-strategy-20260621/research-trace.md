# Research Trace

## Phase 0

Core question:

OpenCode에서 Qwen3.6 35B급 모델을 사용할 때, `ast-grep`, `ripgrep`, `jq`, `yq`, `mdq`, `fd` 등을 모델에게 직접 "활용하라"고 지시하는 대신 wrapper와 shell recipe를 제공해 모델 부담을 줄이는 전략을 어떻게 문서화할 것인가.

Axes:

1. Local prior research: 기존 workspace `research/`, `docs/research/`, Tiny-Chu, Tinker.Gen 문서에서 OpenCode/Qwen/small-model/helper CLI 근거 확인.
2. OpenCode mechanics: custom commands, custom tools, MCP, permissions, agents, providers/models 조사.
3. CLI shortlist: `jq`, `yq`, `rg`, `fd`, `ast-grep`, `mdq`, `just`, `hyperfine`, `miller`, `httpie` 등 추천 근거 조사.
4. Wrapper pattern examples: upstream README/docs에서 shell wrapper, recipe catalog, AST rule catalog, output normalization 패턴 확인.
5. Model-context strategy: Qwen 계열 agentic coding model card와 tool-use research 기반으로 wrapper 필요성 확인.
6. Local verification: 설치된 CLI로 output compression 검증.

Codebase relevant: yes  
External: yes  
Browsing: yes  
Verification likely: yes  
Report requested: Markdown documents under `research/`

## Wave 1

Workers:

- Local research/doc inventory.
- OpenCode docs and repo mechanics.
- CLI tool recommendation sweep.
- OSS wrapper/recipe pattern sweep.
- Qwen/model-context strategy sweep.
- Local CLI availability and verification.

Key findings:

- 기존 `research/opencode-small-model-helper-cli/`는 typed helper tool 결론을 이미 제공한다.
- 이번 문서의 차별점은 repeated CLI pattern을 wrapper/recipe/catalog로 승격하는 구체 전략이다.
- OpenCode는 permission, custom command, custom tool, MCP, agent/model routing을 제공한다.
- `jq`, `yq`, `rg`, `fd`는 현재 로컬 설치되어 실행 검증 가능하다.
- `ast-grep`, `mdq`, `just`, `hyperfine`은 전략상 가치가 있지만 로컬에는 없다.
- `yq` official README는 Docker/Podman shell function wrapper 예시를 제공한다.
- `ast-grep` JSON mode와 outline/rule-catalog 설계는 agent-facing compact navigation primitive로 중요하다.

EXPAND markers deduplicated:

- `mdq` source reliability.
- `ast-grep outline` and rule-catalog pattern.
- OpenCode command/custom tool/MCP split.
- `yq` stdin/file duality and wrapper function.
- `fd` command template and action execution caveat.
- `rg --json`, sort, multiline, PCRE2 advanced toggles.
- `just` recipe catalog and cross-shell support.
- Qwen tool/function-call and multi-turn reliability caveat.

## Expansion Wave 2

Thread limit prevented spawning more subagents, so expansion was closed by orchestrator using already fetched official docs and direct web reads.

Closed findings:

- `mdq`: `yshavit/mdq` is a plausible optional Markdown query candidate. It supports Markdown-shaped selectors for sections, lists, tasks, links, images, quotes, code blocks, tables, and front matter. However, it is not installed locally, and JSON output/large-doc behavior were not verified. Decision: P2 optional, not bootstrap required.
- `ast-grep outline`: source-backed as a strong agent-navigation design pattern, but local execution cannot be verified until `sg` is installed. Decision: P1 recommended with doctor and fixture tests.
- OpenCode surface split: official docs support custom commands for prompt workflows, custom tools for typed local logic, MCP for external tools, and permissions for gating. Decision: wrapper strategy should use custom tools first, MCP only when cross-repo reuse justifies tool/context cost.
- `yq`: official docs and local verification show both power and syntax caveat. Decision: pin Mike Farah v4 and keep query expressions in wrapper catalog.
- `fd -x`/`-X`: useful upstream pattern, but action execution can create side effects. Decision: read-only file discovery by default, action templates behind `ask`.

## Expansion Wave 3

No new actionable leads remained after Wave 2. Remaining items are implementation follow-ups, not research blockers:

- Install and verify `ast-grep`.
- Install and verify `mdq`.
- Install and verify `just`.
- Build OpenCode custom tool prototype.
- Run Qwen/OpenCode end-to-end replay.

Convergence reason:

The core research question is answered with source-backed operating rules, local verification for P0 tools, and explicit caveats for unavailable tools. Unchecked leads are implementation tasks outside this documentation request.

## Verification Artifacts

- `verification-log.md`
- local command outputs from `jq`, `yq`, `rg --json`, `fd`
- current PATH availability checks

## Deliverable Files

- `README.md`
- `wrapper-patterns.md`
- `cli-tool-recommendations.md`
- `opencode-integration-contract.md`
- `verification-log.md`
- `research-trace.md`
- `sources.md`
