# OpenCode small model 보조 CLI 리서치

작성일: 2026-06-21

## 산출물 색인

- `README.md`: 최종 리서치 요약과 권장안.
- `구현-계약.md`: OpenCode custom tool/MCP wrapper 계약, permission 정책, bootstrap 기준.
- `검증-로그.md`: 로컬 실행 검증 결과와 미검증 항목.
- `리서치-추적.md`: 조사 wave, 확장 lead, dead-end, 수렴 조건.
- `출처.md`: 주요 공식 문서와 보조 근거 링크.

## 결론

`qwen3.6-35B-A3B`나 `Qwen3-Coder` 계열 small-active-parameter 모델을 OpenCode에 붙일 때, `ast-grep`, `ripgrep`, `fd`, `jq`, `yq`, `mdq` 같은 CLI는 충분히 유효한 보조 수단이다. 다만 이 도구들이 대체할 수 있는 영역은 검색, 경로 선택, 구조화 데이터 추출, AST 기반 탐색, rewrite preview, evidence packet 생성까지다. 모델의 추론력, repo-wide 설계 판단, 검증-heavy 구현 능력을 CLI wrapper가 대신하지는 못한다.

따라서 권장 방향은 “small model에게 더 많은 shell 자유도를 주는 것”이 아니라, OpenCode 안에 좁고 typed 된 helper tool surface를 제공하는 것이다.

## 핵심 판단

1. OpenCode 기본 도구를 먼저 쓴다.
   - `grep`, `glob`, `read`, `lsp`, `apply_patch`는 OpenCode 기본 tool surface에 남긴다.
   - OpenCode의 검색 계층은 이미 `ripgrep` 성격을 일부 흡수하고 있으므로, 단순 검색만 위해 raw `rg` tool을 중복 노출할 필요는 낮다.

2. CLI는 typed custom tool 또는 작은 MCP bridge로 감싼다.
   - `fd`: 파일 발견과 path filtering.
   - `rg --json`: line, offset, submatch, summary를 포함한 machine-readable text evidence.
   - `ast-grep`: AST 구조 검색과 rewrite preview.
   - `jq`: JSON scalar/record projection.
   - Mike Farah `yq`: YAML/JSON/TOML/XML 등 구조화 파일을 명시적 output format으로 변환.
   - `yshavit/mdq`: Markdown heading, task, link, table, front matter query. 단, bootstrap으로 설치할 때만 필수 도구로 취급한다.

3. broad `bash`는 fallback으로만 둔다.
   - `bash` 전체를 allow하면 small model의 실수가 바로 filesystem/network side effect로 이어진다.
   - OpenCode permission에서 helper command 패턴만 allow하고 나머지는 ask/deny로 둔다.

4. Qwen small model 자체의 한계는 인정해야 한다.
   - Qwen3.6/Qwen3-Coder 계열은 agentic coding을 목표로 설계된 모델이지만, 도구 wrapper만으로 약한 모델이 강한 repo-level coder가 되지는 않는다.
   - CLI 보조는 hallucinated path, brittle parsing, regex 기반 코드 수정, 과도한 context 사용을 줄이는 데 가장 효과적이다.

## 권장 OpenCode 구성

### Tool tier

| Tier | 용도 | 권장 노출 |
| --- | --- | --- |
| OpenCode built-in | 기본 탐색, 파일 읽기, patch, LSP | `grep`, `glob`, `read`, `lsp`, `apply_patch` |
| Custom tools | 결정적 local CLI wrapper | `helper_find_files`, `helper_search_text`, `helper_json_query`, `helper_yaml_query`, `helper_markdown_query`, `helper_ast_search`, `helper_ast_rewrite_preview` |
| MCP | protocol server가 이미 강한 도구 | `ast-grep-mcp` 중심. 너무 많은 MCP server는 context 비용 때문에 피한다. |
| Bash fallback | helper가 없는 예외 상황 | 기본 `ask`, 일부 safe command만 pattern allow |

### 권한 예시

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
    "bash": {
      "*": "ask",
      "rg *": "allow",
      "fd *": "allow",
      "jq *": "allow",
      "yq *": "allow",
      "mdq *": "allow",
      "ast-grep *": "ask",
      "rm *": "deny",
      "curl *": "deny",
      "wget *": "deny"
    }
  }
}
```

### small model prompt 원칙

Small model에게는 “shell을 써라”가 아니라 아래처럼 지시해야 한다.

```text
먼저 typed helper tool을 사용한다.
helper가 없을 때만 bash를 사용한다.
모든 claim은 evidence ref, command, output summary, uncertainty를 함께 반환한다.
rewrite는 preview tool 결과를 먼저 보고, apply는 별도 승인 뒤에만 한다.
```

## 도구별 판단

### `ripgrep` / `rg`

`rg`는 text evidence 검색의 기본값으로 적합하다. `.gitignore`를 존중하고 hidden/binary file을 기본적으로 피하며, glob/type filter와 `--json`을 제공한다. 로컬 검증에서 `rg --json`은 `begin`, `match`, `end`, `summary` 이벤트를 NDJSON으로 출력했고, match에는 path, line number, offset, submatch가 포함됐다.

권장 wrapper:

```text
helper_search_text(pattern, paths, globs, maxMatches, mode=json)
```

반환값은 raw terminal output이 아니라 capped match 배열이어야 한다.

### `fd`

`fd`는 `find`의 일반적인 대체재로 적합하다. small model이 가장 자주 실패하는 “어떤 파일을 봐야 하는가” 문제에서 ignore-aware traversal, extension/type filtering, glob filtering이 유용하다.

권장 wrapper:

```text
helper_find_files(root, pattern, extensions, type, includeHidden, maxFiles)
```

### `ast-grep`

`ast-grep`는 코드 수정 보조에서 가장 가치가 크다. 문자열 grep이 아니라 AST node를 대상으로 검색하고, `$A`, `$$$ARGS` 같은 metavariable을 지원한다. JSON output, stream/compact mode, rewrite, rule test, MCP server가 있어 small model이 freehand edit 대신 구조화된 search/rewrite contract를 만들 수 있다.

권장 wrapper:

```text
helper_ast_search(language, pattern, paths, maxMatches)
helper_ast_rewrite_preview(language, pattern, rewrite, paths)
```

`helper_ast_rewrite_preview`는 항상 `ask`로 두고, 실제 apply는 OpenCode의 `apply_patch`나 별도 승인된 safe apply 경로를 타야 한다.

### `jq`

`jq`는 JSON evidence packet 생성에 가장 안전하다. `-r`, `-c`, `-S`, `--stream`을 활용하면 full JSON file을 context에 넣지 않고 필요한 scalar/record만 뽑을 수 있다.

권장 wrapper:

```text
helper_json_query(pathOrStdin, expression, output=compact, maxBytes)
```

### `yq`

`yq`는 반드시 구현체를 pin해야 한다. 이 문서의 권장 대상은 Mike Farah `yq` v4다. Kislyuk `yq`는 Python wrapper로 `jq`에 YAML/XML/TOML을 연결하는 도구라 의미가 다르다.

권장 wrapper:

```text
helper_yaml_query(pathOrStdin, expression, output=json, implementation=mikefarah-v4)
```

### `mdq`

`mdq`는 Markdown query에 유효하지만, exact implementation을 pin해야 한다. 조사 결과 권장 후보는 `yshavit/mdq`다. heading, task, link, table, front matter query와 `--output json` 흐름이 확인됐다. 다만 현재 로컬에는 설치되어 있지 않았다.

권장 wrapper:

```text
helper_markdown_query(pathOrStdin, selector, output=json, maxItems)
```

필수 도구로 삼으려면 installer/bootstrap에 포함해야 한다.

## 로컬 검증 결과

검증 fixture 위치:

```text
.omo/ultraresearch/20260621-opencode-small-model-tools/fixtures/
```

실행 확인:

| 도구 | 로컬 상태 | 검증 결과 |
| --- | --- | --- |
| `rg` | 설치됨: `ripgrep 14.1.1` | `--json` NDJSON output 확인 |
| `fd` | 설치됨: `fd 10.2.0` | file list와 TypeScript extension filtering 확인 |
| `jq` | 설치됨: `jq 1.7.1` | compact JSON projection 확인 |
| `yq` | 설치됨: Mike Farah `v4.47.2` | YAML steps를 JSON으로 변환 확인 |
| `ast-grep` | 미설치 | source/documentation 기반 검증만 수행 |
| `mdq` | 미설치 | `yshavit/mdq` 문서 기반 검증만 수행 |

검증 기록:

```text
.omo/ultraresearch/20260621-opencode-small-model-tools/verify-cli-output-shape.md
```

## Tiny-Chu / Tinker.Gen 적용 가능성

Tiny-Chu는 이미 이 방향과 상당히 맞아 있다.

- `src/opencode/powershell-tooling.ts`는 `jq`, `yq`, `mdq`, `fd`, `ast-grep`, `ripgrep` native tool profile을 가지고 있다.
- 같은 파일은 native JSON output을 fragile text parsing보다 우선하라고 안내한다.
- `src/opencode/native-tool-wrappers.ts`에는 `ast-grep`, `jq`, `yq` preview wrapper가 있고, root-relative path check와 bounded output을 적용한다.
- `test/tiny-chu.test.mjs`는 OpenCode runtime/orchestration profile에 native tools가 포함되는지 검증한다.

Tinker.Gen은 Tiny-Chu 내부 module로 import하지 말고 CLI/bridge boundary로 유지하는 것이 맞다. OpenCode 구성에서는 Tiny-Chu, Tinker.Gen bridge, CodeGraph/helper tooling을 sibling plugin/tool 계층으로 조합하는 쪽이 안전하다.

## 구현 제안

1. `research/` 문서를 기준으로 helper tool contract를 확정한다.
2. `.opencode/tools/` 또는 별도 npm plugin으로 아래 wrapper를 만든다.
   - `helper_find_files`
   - `helper_search_text`
   - `helper_json_query`
   - `helper_yaml_query`
   - `helper_markdown_query`
   - `helper_ast_search`
   - `helper_ast_rewrite_preview`
3. `ast-grep`와 `mdq` 설치 여부를 `doctor`/`install-check`에서 검사한다.
4. OpenCode permission 기본값은 broad `bash: ask`, helper read-only tools `allow`, rewrite preview/apply `ask`로 둔다.
5. small model replay fixture를 만들어 “same prompt with broad bash”와 “same prompt with typed helpers”를 비교한다.

## 한계

- 실제 Qwen3.6 모델을 OpenCode에 연결해 end-to-end 실행하지는 않았다.
- 현재 `anomalyco/opencode` repo를 full clone해 call chain까지 확인하지는 않았다. OpenCode 관련 판단은 공식 docs, GitHub source snippet, 공개 예시를 기준으로 했다.
- `ast-grep`와 `mdq`는 로컬에 설치되어 있지 않아 실행 검증은 하지 못했다.
- 과거 `opencode-ai/opencode` Go 구현을 조사한 worker 결과는 현재 OpenCode 구현 근거로 쓰지 않았다. 현재 공식 경로는 `anomalyco/opencode` / `sst/opencode` 계열이다.

## 주요 출처

- OpenCode 도구: https://opencode.ai/docs/tools/
- OpenCode custom tool: https://opencode.ai/docs/custom-tools/
- OpenCode MCP server: https://opencode.ai/docs/mcp-servers/
- OpenCode permission: https://opencode.ai/docs/permissions/
- Qwen3.6-35B-A3B model card: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
- Qwen3-Coder-Next 기술 보고서: https://arxiv.org/abs/2603.00729
- ast-grep 문서: https://ast-grep.github.io/
- ast-grep MCP: https://github.com/ast-grep/ast-grep-mcp
- ripgrep: https://github.com/BurntSushi/ripgrep
- fd: https://github.com/sharkdp/fd
- jq manual: https://jqlang.org/manual/
- Mike Farah yq: https://mikefarah.gitbook.io/yq/
- Kislyuk yq: https://github.com/kislyuk/yq
- yshavit mdq: https://github.com/yshavit/mdq
