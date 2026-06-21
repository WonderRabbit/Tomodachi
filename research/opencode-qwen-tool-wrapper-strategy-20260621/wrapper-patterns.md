# Wrapper Pattern Catalog

목표: Qwen 계열 모델이 raw shell과 CLI syntax를 직접 조합하지 않게 만들고, 반복되는 패턴을 OpenCode custom tool, MCP tool, custom command, `just` recipe, shell script로 승격한다.

## 설계 원칙

1. 모델에게 command string을 쓰게 하지 않는다.
   - wrapper 내부에서 argv array로 실행한다.
   - `shell: true` 또는 string interpolation은 피한다.
2. 모델에게 raw stdout을 주지 않는다.
   - path, line, symbol, count, snippet, command, exitCode만 반환한다.
   - `maxMatches`, `maxBytes`, `maxFiles`를 기본값으로 둔다.
3. query expression은 catalog화한다.
   - "jq를 써라"가 아니라 `packageScripts`, `tsconfigPaths`, `opencodePermissions` 같은 named pattern을 둔다.
4. write path는 preview와 apply를 분리한다.
   - search/rewrite preview는 `allow` 또는 `ask`.
   - 실제 patch/apply는 OpenCode `apply_patch` 또는 별도 승인.

## Pattern 1: JSON projection wrapper

문제:

```bash
jq -c '{scripts:.scripts, deps:(.dependencies // {} | keys)}' package.json
```

이 command는 짧아 보여도 small model에게는 quoting, fallback operator, compact output, key ordering, stderr 처리 부담이 있다.

Wrapper:

```ts
helper_json_query({
  path: "package.json",
  query: "package-summary",
  maxBytes: 4096
})
```

내부 recipe:

```bash
jq -c -S '{scripts:(.scripts // {}), deps:(.dependencies // {} | keys), devDeps:(.devDependencies // {} | keys)}' package.json
```

반환:

```json
{
  "ok": true,
  "query": "package-summary",
  "path": "package.json",
  "data": {
    "scripts": {"test": "vitest"},
    "deps": ["@opencode-ai/plugin"],
    "devDeps": ["typescript"]
  }
}
```

모델 부담 감소:

- `jq` filter 작성 부담 제거.
- compact output과 key sort를 wrapper가 보장.
- missing key 처리를 wrapper가 보장.

## Pattern 2: YAML/OpenCode config query wrapper

문제:

Mike Farah `yq`는 jq-like지만 완전히 jq와 같지는 않다. 로컬 검증에서도 `{name, tool}` 형태는 실패했고 `{"name": .name, "tool": .tool}` 형태는 성공했다. 따라서 expression을 모델에게 맡기지 않는 편이 낫다.

Wrapper:

```ts
helper_yaml_query({
  path: "opencode.jsonc",
  query: "permissions",
  output: "json"
})
```

내부 recipe:

```bash
yq -o=json '.permission' opencode.jsonc | jq -c -S .
```

반환:

```json
{
  "ok": true,
  "query": "permissions",
  "data": {
    "bash": "ask",
    "read": "allow"
  }
}
```

운영 규칙:

- `yq` implementation은 Mike Farah v4로 pin한다.
- Python `yq`와 혼동하지 않게 doctor에서 `yq --version`을 확인한다.
- in-place edit인 `yq -i`는 helper default에서 제외한다.

## Pattern 3: `rg --json` evidence wrapper

문제:

```bash
rg --json 'function|class|export' src | jq ...
```

raw `rg` output은 빠르지만 모델이 line format을 해석해야 하고, `--json`을 쓰면 NDJSON event를 다시 처리해야 한다.

Wrapper:

```ts
helper_search_text({
  pattern: "function",
  paths: ["src"],
  globs: ["*.ts"],
  maxMatches: 20
})
```

내부 recipe:

```bash
rg --json --glob '*.ts' 'function' src
```

정규화:

```json
{
  "ok": true,
  "matches": [
    {
      "path": "src/a.ts",
      "line": 12,
      "text": "export function run() { ... }",
      "submatches": [{"start": 7, "end": 15, "match": "function"}]
    }
  ],
  "truncated": false
}
```

모델 부담 감소:

- NDJSON event parsing 제거.
- file path, line number, snippet만 남김.
- hidden/binary/ignore 기본 정책을 wrapper가 고정.

## Pattern 4: `fd` file candidate wrapper

문제:

모델은 file discovery에서 `find`, glob, ignore, hidden, extension filter를 자주 섞어 실수한다.

Wrapper:

```ts
helper_find_files({
  root: ".",
  pattern: "opencode",
  extensions: ["md", "ts", "json"],
  maxFiles: 50
})
```

내부 recipe:

```bash
fd opencode . -e md -e ts -e json --type file
```

반환:

```json
{
  "ok": true,
  "files": [
    {"path": "research/opencode-small-model-helper-cli/README.md"},
    {"path": "docs/research/opencode-qwen-small-model-failure-cases.md"}
  ],
  "truncated": false
}
```

주의:

- `fd -x`와 `fd -X`는 강력하지만 side effect가 생길 수 있다.
- OpenCode 기본 helper에서는 discovery까지만 허용하고, follow-up command는 `helper_run_recipe` 또는 별도 approval로 둔다.

## Pattern 5: `ast-grep` structural search wrapper

문제:

`rg "console.log"`는 comment/string까지 잡을 수 있고, multiline syntax와 language별 AST를 이해하지 못한다.

Wrapper:

```ts
helper_ast_search({
  language: "TypeScript",
  pattern: "console.log($$$ARGS)",
  paths: ["src"],
  maxMatches: 50
})
```

내부 recipe:

```bash
sg run --lang ts -p 'console.log($$$ARGS)' --json=stream src
```

반환:

```json
{
  "ok": true,
  "matches": [
    {
      "path": "src/debug.ts",
      "range": {"startLine": 4, "startColumn": 2, "endLine": 4, "endColumn": 31},
      "text": "console.log(value)",
      "captures": {"ARGS": "value"}
    }
  ]
}
```

출처상 근거:

- ast-grep은 pattern syntax에서 `$META`와 `$$$ARGS` 같은 meta variable을 제공한다.
- ast-grep JSON mode는 `--json=stream`, `--json=compact`, `--json=pretty`를 제공한다.
- ast-grep rewrite 문서는 find와 patch를 분리하고 rule/transform/fix를 사용한다.

## Pattern 6: rewrite preview wrapper

문제:

small model이 `sed -i`, `perl -pi`, `yq -i`, `sg -r`를 직접 실행하면 영향 범위를 잘못 판단하기 쉽다.

Wrapper:

```ts
helper_ast_rewrite_preview({
  language: "TypeScript",
  pattern: "console.log($$$ARGS)",
  rewrite: "logger.debug($$$ARGS)",
  paths: ["src"]
})
```

반환:

```json
{
  "ok": true,
  "mode": "preview",
  "affectedFiles": 2,
  "diffSummary": [
    {"path": "src/debug.ts", "replacements": 3}
  ],
  "applyAllowed": false
}
```

운영 규칙:

- preview는 `ask` 또는 `allow`.
- apply는 별도 tool로 분리하거나 OpenCode `apply_patch`만 사용.
- preview output은 diff 전체가 아니라 file별 count와 작은 snippet 중심으로 capped 한다.

## Pattern 7: Markdown query wrapper

후보:

- `yshavit/mdq`: Markdown syntax를 닮은 selector로 section, list, task, link, image, quote, code block, table, front matter를 고를 수 있다.

Wrapper:

```ts
helper_markdown_query({
  path: "README.md",
  selector: "# Usage | -",
  maxItems: 30
})
```

상태:

- 현재 로컬에는 `mdq`가 설치되어 있지 않다.
- 따라서 P2 optional tool로 둔다.
- 필수 도구로 올리려면 version pin, install 방법, JSON output 여부, large markdown behavior를 검증해야 한다.

## Pattern 8: `just` recipe catalog

문제:

작은 모델이 `npm test -- ...`, `bun test`, `pnpm`, `tsc`, `vitest`, `pytest`를 repo마다 재구성하면 실패한다.

Recipe:

```just
list-tools:
  node scripts/helper-tools.mjs list

verify-wrapper:
  node scripts/helper-tools.mjs verify

search-json query:
  node scripts/helper-tools.mjs json-query "{{query}}"
```

OpenCode command:

```md
---
description: Run wrapper verification
agent: build
---

Run `helper_run_recipe({ "recipe": "verify-wrapper" })`.
Summarize only failing checks and exact command evidence.
```

모델 부담 감소:

- 반복 명령은 이름으로 호출한다.
- repo별 package manager 차이를 recipe가 숨긴다.
- `just --list`로 command catalog를 노출할 수 있다.

## 승격 기준

| 상태 | 처리 |
| --- | --- |
| 한 번만 쓰는 명령 | raw `bash` 가능, `ask` |
| 두 번 이상 반복되는 read-only 명령 | `.opencode/commands/` 또는 helper wrapper |
| output parsing이 필요한 명령 | custom tool |
| 여러 repo에서 재사용할 명령 | MCP tool 또는 npm package |
| write side effect가 있는 명령 | preview/apply 분리, apply는 `ask` |
| install/doctor가 필요한 명령 | bootstrap check 추가 |
