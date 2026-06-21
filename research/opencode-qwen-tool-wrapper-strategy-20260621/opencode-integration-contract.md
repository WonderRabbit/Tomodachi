# OpenCode 통합 계약

## 목적

OpenCode에서 Qwen3.6/Qwen3-Coder 계열 모델을 사용할 때, raw shell을 직접 열어두는 대신 wrapper tool과 command catalog를 제공하는 계약이다.

## OpenCode surface 선택 기준

| Surface | 쓰는 경우 | 예 |
| --- | --- | --- |
| `.opencode/commands/` | prompt orchestration, 반복 workflow | `/scan-config`, `/review-wrapper-output` |
| `.opencode/tools/` custom tool | structured I/O, validation, local CLI 실행 | `helper_json_query`, `helper_search_text` |
| MCP server | 여러 repo/agent에서 재사용할 protocol tool | `toolkit_query_json`, `toolkit_ast_search` |
| `just` recipe | repo-local command catalog | `just verify-wrapper` |
| broad `bash` | helper가 없는 예외 | 기본 `ask` |

## Custom tool 기본 구조

OpenCode custom tool은 TypeScript/JavaScript file로 정의하고, 내부에서 다른 언어 script를 실행할 수 있다. tool argument는 schema로 제한한다.

```ts
import { tool } from "@opencode-ai/plugin"
import { spawnFile } from "./lib/safe-spawn"

export default tool({
  description: "Query JSON files with a pinned recipe catalog",
  args: {
    path: tool.schema.string().describe("Workspace-relative JSON file path"),
    query: tool.schema.enum(["package-summary", "opencode-permissions"]),
    maxBytes: tool.schema.number().default(4096),
  },
  async execute(args, context) {
    const result = await spawnFile(context.worktree, "jq", buildJqArgs(args))
    return normalizeJsonResult(result, args.maxBytes)
  },
})
```

필수 구현 규칙:

- `context.worktree` 기준 root-relative path만 허용한다.
- absolute path, `..`, symlink root escape를 거부한다.
- shell string을 만들지 않고 argv array로 실행한다.
- stdout/stderr를 byte cap으로 제한한다.
- 실패 시 `ok:false`, `exitCode`, `stderrSummary`, `hint`를 반환한다.

## 권장 helper schema

### `helper_find_files`

```ts
{
  root?: string,
  pattern?: string,
  extensions?: string[],
  type?: "file" | "dir" | "any",
  includeHidden?: boolean,
  respectIgnore?: boolean,
  maxFiles?: number
}
```

### `helper_search_text`

```ts
{
  pattern: string,
  paths?: string[],
  globs?: string[],
  caseSensitive?: boolean,
  multiline?: boolean,
  pcre2?: boolean,
  sort?: "none" | "path",
  maxMatches?: number
}
```

### `helper_json_query`

```ts
{
  path?: string,
  input?: string,
  query: "package-summary" | "opencode-permissions" | "tsconfig-summary" | "raw",
  expression?: string,
  output?: "compact" | "pretty" | "raw",
  maxBytes?: number
}
```

규칙:

- `expression`은 `query:"raw"`일 때만 허용한다.
- `query:"raw"`는 기본 `ask`로 둔다.

### `helper_yaml_query`

```ts
{
  path?: string,
  input?: string,
  query: "workflow-steps" | "opencode-permissions" | "raw",
  expression?: string,
  output?: "json" | "yaml" | "raw",
  implementation: "mikefarah-v4",
  maxBytes?: number
}
```

### `helper_ast_search`

```ts
{
  language: "TypeScript" | "JavaScript" | "Python" | "Rust" | "Go",
  pattern: string,
  paths: string[],
  maxMatches?: number
}
```

### `helper_ast_rewrite_preview`

```ts
{
  language: string,
  pattern: string,
  rewrite: string,
  paths: string[],
  maxDiffBytes?: number
}
```

규칙:

- 항상 preview만 반환한다.
- 실제 파일 수정은 하지 않는다.
- `applyAllowed:false`를 output에 포함한다.

## Permission profile

### 기본 profile

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

### plan agent

```jsonc
{
  "permission": {
    "*": "ask",
    "read": "allow",
    "grep": "allow",
    "glob": "allow",
    "helper_find_files": "allow",
    "helper_search_text": "allow",
    "helper_json_query": "allow",
    "helper_yaml_query": "allow",
    "helper_ast_search": "allow",
    "edit": "deny",
    "bash": "ask"
  }
}
```

### build agent

```jsonc
{
  "permission": {
    "*": "ask",
    "read": "allow",
    "grep": "allow",
    "glob": "allow",
    "lsp": "allow",
    "apply_patch": "ask",
    "helper_find_files": "allow",
    "helper_search_text": "allow",
    "helper_json_query": "allow",
    "helper_yaml_query": "allow",
    "helper_ast_search": "allow",
    "helper_ast_rewrite_preview": "ask",
    "bash": {
      "*": "ask",
      "npm test*": "allow",
      "npm run build*": "allow",
      "git status*": "allow",
      "rg *": "allow",
      "fd *": "allow"
    }
  }
}
```

## Command catalog 예시

### `.opencode/commands/scan-wrapper-surface.md`

```md
---
description: 제한된 helper tool로 project wrapper/tool surface를 스캔한다
agent: plan
---

OpenCode, tool, MCP, helper file은 helper_find_files로 찾는다.
targeted evidence에만 helper_search_text를 사용한다.
config file에는 helper_json_query/helper_yaml_query를 사용한다.
Return:
- relevant files
- detected wrappers
- missing doctor checks
- uncertainty
helper가 없을 때만 raw bash를 사용한다.
```

### `.opencode/commands/verify-wrapper-fixtures.md`

```md
---
description: Run wrapper fixture checks and summarize failures
agent: build
---

Run helper_run_recipe({ "recipe": "verify-wrapper" }).
Report only:
- failed check name
- command
- normalized stderr summary
- next fix target
```

## MCP로 올릴 때의 기준

MCP는 tool 수가 context를 늘릴 수 있으므로 무조건 늘리면 안 된다. OpenCode MCP docs도 많은 MCP tool이 context limit을 빠르게 소모할 수 있다고 경고한다.

MCP 승격 기준:

- 여러 repo에서 같은 wrapper가 필요하다.
- OpenCode custom tool보다 protocol boundary가 유리하다.
- tool count를 작게 유지할 수 있다.
- permission wildcard가 명확하다.

권장 MCP tool namespace:

```text
qtool_find_files
qtool_search_text
qtool_json_query
qtool_yaml_query
qtool_ast_search
qtool_ast_preview
```

## Doctor checks

필수:

```text
jq --version
yq --version
rg --version
fd --version
```

강화:

```text
sg --version 또는 ast-grep --version
just --version
mdq --version
```

검증해야 할 항목:

- version
- executable path
- implementation family, 특히 `yq`
- JSON/NDJSON output fixture
- max output cap 동작
- workspace root escape 차단

## Done 기준

wrapper 전략이 완료되었다고 보려면 아래를 만족해야 한다.

- 모델 prompt에 raw shell 사용 지시가 없다.
- 반복 command는 custom command, custom tool, MCP, recipe 중 하나로 승격되어 있다.
- helper output은 typed JSON으로 capped 된다.
- rewrite helper는 preview만 수행한다.
- doctor가 missing CLI와 implementation mismatch를 잡는다.
- permission profile이 broad `bash`를 기본 허용하지 않는다.
