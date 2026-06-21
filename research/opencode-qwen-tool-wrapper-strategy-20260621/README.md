# OpenCode + Qwen 계열 모델용 Tool Wrapper 전략

작성일: 2026-06-21  
대상: OpenCode에서 Qwen3.6-35B-A3B, Qwen3-Coder 30B/35B-active급 모델을 사용할 때의 CLI tool 사용 전략  
결론: 모델에게 `ast-grep`, `ripgrep`, `jq`, `yq`, `mdq`, `fd`를 "그냥 활용하라"고 맡기면 안 된다. 반복되는 패턴은 wrapper, recipe, custom tool, MCP tool로 올려 모델의 shell 조합 부담을 줄여야 한다.

## 산출물

- `README.md`: 결론과 운영 모델.
- `wrapper-patterns.md`: `jq`, `yq`, `rg`, `fd`, `ast-grep` 중심 wrapper recipe catalog.
- `cli-tool-recommendations.md`: 추천 CLI tool, 추천 사유, 도입 우선순위.
- `opencode-integration-contract.md`: OpenCode custom command/custom tool/MCP/permission 계약.
- `verification-log.md`: 로컬 실행 검증과 미검증 항목.
- `research-trace.md`: ultraresearch wave, expansion, 수렴 기록.
- `sources.md`: 출처 색인.

## 핵심 판단

OpenCode는 built-in tool, custom tool, MCP server, permission, agent, model routing을 모두 제공한다. 공식 문서는 custom tool을 `.opencode/tools/` 또는 global tool path에 둘 수 있고, `tool()` helper와 schema로 argument validation을 붙일 수 있다고 설명한다. 또한 permission은 `allow`, `ask`, `deny` 및 tool input rule로 제어된다. 따라서 Qwen 계열 small-active-parameter 모델에게 broad `bash`를 넓게 열기보다, 좁은 wrapper surface를 OpenCode tool로 제공하는 것이 맞다.

Qwen3.6-35B-A3B model card는 35B total, 3B activated, native 262,144 context를 제시하고 agentic coding 개선을 강조한다. 하지만 긴 context와 agentic benchmark 근거는 "raw shell을 잘 조합한다"는 보장이 아니다. 로컬 모델에게 가장 큰 부담은 repo 판단보다 더 낮은 층에서 자주 터진다: quoting, pipe, glob, JSON/YAML query syntax, grep 결과 정리, 너무 긴 stdout, rewrite preview 없이 바로 수정하는 행동이다.

따라서 전략은 다음이다.

1. CLI를 직접 노출하지 말고 의미 단위 wrapper로 묶는다.
2. wrapper 입력은 schema로 제한하고, 실행은 argv array로 한다.
3. wrapper 출력은 raw stdout이 아니라 capped JSON record로 정규화한다.
4. read-only wrapper는 `allow`, rewrite/apply류는 `ask`, broad `bash`는 기본 `ask` 또는 `deny`로 둔다.
5. 반복 shell pattern은 `just` recipe 또는 `.opencode/commands/`로 catalog화한다.

## 권장 tool surface

| Tool | 내부 CLI | 모델에게 보일 의미 | 기본 권한 |
| --- | --- | --- | --- |
| `helper_find_files` | `fd` | 파일 후보 검색 | `allow` |
| `helper_search_text` | `rg --json` | text evidence 검색 | `allow` |
| `helper_json_query` | `jq` | JSON projection, count, stable key output | `allow` |
| `helper_yaml_query` | Mike Farah `yq` | YAML/JSON/TOML/XML query | `allow` |
| `helper_markdown_query` | `mdq` 또는 대체 구현 | Markdown heading/task/link/table query | `optional allow` |
| `helper_ast_search` | `ast-grep`/`sg` | AST 구조 검색 | `allow` |
| `helper_ast_rewrite_preview` | `ast-grep`/`sg` | rewrite preview 생성 | `ask` |
| `helper_run_recipe` | `just` 또는 curated shell script | 허용된 project recipe 실행 | `ask` 또는 recipe별 `allow` |

## 왜 wrapper가 Qwen 부담을 줄이는가

Qwen3-Coder 계열은 tool calling과 agentic coding을 목표로 하지만, multi-turn tool use는 여전히 단일 function-call 정확도와 다르다. tool-use 연구는 긴 tool 설명과 일관성 없는 tool surface가 성능과 token 비용을 악화시킨다는 방향을 지지한다. wrapper는 모델이 직접 해야 할 결정을 줄인다.

- `jq` expression을 매번 만들게 하지 않고 `selectPackageScripts`, `summarizeTsconfig`, `readOpencodePermissions` 같은 named query로 둔다.
- `rg --json | jq ...` pipe를 매번 만들게 하지 않고 `helper_search_text`가 match array만 반환한다.
- `fd -e ts -E dist -E node_modules`를 매번 조합하게 하지 않고 `helper_find_files({extensions:["ts"], excludes:["dist","node_modules"]})`로 둔다.
- `ast-grep` pattern/rewrite는 preview 전용으로 두고 apply는 OpenCode `apply_patch` 또는 별도 승인 단계로 분리한다.

## 도입 우선순위

1. P0: `jq`, `yq`, `rg`, `fd` wrapper
   - 현재 로컬에 설치되어 있고 실행 검증이 가능했다.
   - JSON/YAML/text/file discovery는 가장 자주 반복되는 부담이다.
2. P1: `ast-grep`/`sg`
   - 구조적 코드 검색과 rewrite preview에 가장 큰 효과가 있다.
   - 현재 로컬에는 설치되어 있지 않아 bootstrap/doctor가 필요하다.
3. P1: `just`
   - project-local command catalog로 좋다.
   - 현재 로컬에는 설치되어 있지 않아 optional bootstrap 대상으로 둔다.
4. P2: `mdq`
   - Markdown query에 유용하지만 implementation pin과 output contract 검증이 먼저다.
   - 현재 로컬에는 설치되어 있지 않다.
5. P2: `hyperfine`, `miller`, `httpie`/`xh`, `sd`, `gojq`/`jaq`
   - 특정 문제에는 좋지만 Qwen/OpenCode 기본 wrapper surface에는 과하다.

## 기존 연구와의 관계

이 문서는 기존 `research/opencode-small-model-helper-cli/`의 "typed helper tool" 결론을 더 구체화한다. 기존 문서가 어떤 helper tool이 필요한지를 정리했다면, 이 문서는 "반복되는 CLI 패턴을 어떤 wrapper/recipe/catalog로 올릴지"를 정리한다.

관련 기존 문서:

- `research/opencode-small-model-helper-cli/README.md`
- `research/opencode-small-model-helper-cli/구현-계약.md`
- `research/opencode-small-model-helper-cli/검증-로그.md`
- `docs/research/opencode-qwen-small-model-failure-cases.md`
- `research/opencode-qwen-small-model/README.md`
- `research/opencode-ollama-orchestrator-models-20260621/SYNTHESIS.md`

## 바로 적용할 운영 규칙

Small model prompt에는 아래 원칙만 노출한다.

```text
먼저 helper tool을 사용한다.
raw bash는 helper가 없을 때만 사용한다.
JSON/YAML/Markdown은 구조화 query helper를 우선한다.
search result는 evidence ref와 요약만 반환한다.
rewrite는 preview만 수행하고 apply는 별도 승인 뒤에 한다.
```

OpenCode permission 기본값은 아래처럼 둔다.

```jsonc
{
  "permission": {
    "*": "ask",
    "read": "allow",
    "grep": "allow",
    "glob": "allow",
    "lsp": "allow",
    "helper_find_files": "allow",
    "helper_search_text": "allow",
    "helper_json_query": "allow",
    "helper_yaml_query": "allow",
    "helper_markdown_query": "allow",
    "helper_ast_search": "allow",
    "helper_ast_rewrite_preview": "ask",
    "helper_run_recipe": "ask",
    "bash": {
      "*": "ask",
      "git status*": "allow",
      "rg *": "allow",
      "fd *": "allow",
      "jq *": "allow",
      "yq *": "allow",
      "rm *": "deny",
      "git push*": "ask"
    }
  }
}
```

## 한계

- 실제 Qwen3.6-35B-A3B를 OpenCode에 연결해 end-to-end replay를 실행하지는 않았다.
- `ast-grep`, `mdq`, `just`, `hyperfine`은 현재 로컬 PATH에 없어서 실행 검증은 하지 못했다.
- OpenCode의 Qwen 지원은 local/OpenAI-compatible provider 경로를 통한 추론이다. 공식 OpenCode 문서가 Qwen을 직접 지정한 것은 아니다.
- `mdq`는 `yshavit/mdq`를 후보로 확인했지만, 필수 도구로 올리기에는 installer, version pin, JSON output contract 검증이 추가로 필요하다.
