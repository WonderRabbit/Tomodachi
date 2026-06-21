# Sources

Access date: 2026-06-21

## OpenCode

- OpenCode tools: https://opencode.ai/docs/tools/
  - built-in tools, custom tools, MCP extension, permission link.
- OpenCode custom tools: https://opencode.ai/docs/custom-tools/
  - `.opencode/tools/`, global tools, `tool()` helper, schema arguments, context.
- OpenCode permissions: https://opencode.ai/docs/permissions/
  - `allow`, `ask`, `deny`, wildcard and granular object rules.
- OpenCode MCP servers: https://opencode.ai/docs/mcp-servers/
  - local/remote MCP, context caveat, per-agent/global enablement.
- OpenCode agents: https://opencode.ai/docs/agents/
  - primary agents, subagents, agent configuration.
- OpenCode models: https://opencode.ai/docs/models/
  - `provider_id/model_id`, custom model routing.
- OpenCode providers: https://opencode.ai/docs/providers/
  - AI SDK/Models.dev provider routing and local/provider options.
- OpenCode commands: https://opencode.ai/docs/commands/
  - `.opencode/commands/`, markdown commands, frontmatter.
- OpenCode repository: https://github.com/anomalyco/opencode

## Qwen

- Qwen3.6-35B-A3B model card: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
  - 35B total, 3B activated, context length, agentic coding claims.
- Qwen3-Coder-30B-A3B-Instruct model card: https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct
  - smaller coding-agent candidate.
- Qwen3-Coder-Next model card: https://huggingface.co/Qwen/Qwen3-Coder-Next
  - 80B total, 3B active, coding-agent direction.
- Qwen3-Coder blog: https://qwenlm.github.io/blog/qwen3-coder/
- Qwen official repo: https://github.com/QwenLM/Qwen

## CLI tools

- jq manual: https://jqlang.org/manual/
  - `-c`, `-r`, `-S`, stream/raw output behavior.
- jq repository: https://github.com/jqlang/jq
  - README and container usage.
- Mike Farah yq docs: https://mikefarah.gitbook.io/yq/
  - quick usage, stdin/file examples, install notes, known issues.
- Mike Farah yq repo: https://github.com/mikefarah/yq
  - Docker/Podman wrapper function, eval/eval-all examples.
- ripgrep repo: https://github.com/BurntSushi/ripgrep
  - ignore-aware recursive search, type filters, PCRE2, performance notes.
- fd repo: https://github.com/sharkdp/fd
  - simple file discovery, ignore defaults, type filters, command execution templates.
- ast-grep docs: https://ast-grep.github.io/
- ast-grep JSON mode: https://ast-grep.github.io/guide/tools/json.html
  - `--json=pretty`, `--json=stream`, `--json=compact`.
- ast-grep pattern syntax: https://ast-grep.github.io/guide/pattern-syntax.html
  - meta variables and multi meta variables.
- ast-grep rewrite: https://ast-grep.github.io/advanced/find-n-patch.html
  - find/patch/rewrite model.
- ast-grep repo: https://github.com/ast-grep/ast-grep
  - structural search, lint, rewrite, outline design files.
- yshavit mdq repo: https://github.com/yshavit/mdq
  - Markdown-shaped query syntax candidate.
- just manual: https://just.systems/man/en/
- just repo: https://github.com/casey/just
  - recipe catalog and command runner model.
- hyperfine repo: https://github.com/sharkdp/hyperfine
  - command benchmarking.
- Miller docs: https://miller.readthedocs.io/
  - record-shaped data processing.
- HTTPie repo: https://github.com/httpie/cli
- xh repo: https://github.com/ducaale/xh
- sd repo: https://github.com/chmln/sd
- gojq repo: https://github.com/itchyny/gojq
- jaq repo: https://github.com/01mf02/jaq

## Tool-use and agent research

- ReAct: https://arxiv.org/abs/2210.03629
  - interleaving reasoning and acting.
- EASYTOOL: https://arxiv.org/abs/2401.06201
  - concise unified tool instructions reduce token consumption and improve tool-use behavior.
- FunctionChat-Bench: https://arxiv.org/abs/2411.14054
  - multi-turn tool-use caveat.
- Guided-Structured Templates: https://arxiv.org/abs/2509.18076
  - structured templates for function calling.
- ToolRegistry: https://arxiv.org/abs/2507.10593
  - unified tool registry and progressive disclosure.
- Qwen3-Coder-Next technical report: https://arxiv.org/abs/2603.00729

## Local prior docs

- `/Users/oneyoon/Workspace/Personal/research/opencode-small-model-helper-cli/README.md`
- `/Users/oneyoon/Workspace/Personal/research/opencode-small-model-helper-cli/구현-계약.md`
- `/Users/oneyoon/Workspace/Personal/research/opencode-small-model-helper-cli/검증-로그.md`
- `/Users/oneyoon/Workspace/Personal/research/opencode-small-model-helper-cli/출처.md`
- `/Users/oneyoon/Workspace/Personal/research/opencode-qwen-small-model/README.md`
- `/Users/oneyoon/Workspace/Personal/research/opencode-ollama-orchestrator-models-20260621/SYNTHESIS.md`
- `/Users/oneyoon/Workspace/Personal/docs/research/opencode-qwen-small-model-failure-cases.md`
- `/Users/oneyoon/Workspace/Personal/Tinker.Gen/docs/tinychu-tinkergen-coupling-architecture.md`
- `/Users/oneyoon/Workspace/Personal/Tiny-Chu/docs/reports/small-model-opencode-audit.md`
