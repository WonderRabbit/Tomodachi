# Verification Log

작성일: 2026-06-21  
환경: `/Users/oneyoon/Workspace/Personal`, macOS/Homebrew PATH 기준

## Local CLI availability

| Tool | 상태 | Version / path |
| --- | --- | --- |
| `jq` | 설치됨 | `/opt/homebrew/bin/jq`, `jq-1.7.1` |
| `yq` | 설치됨 | `/opt/homebrew/bin/yq`, Mike Farah `v4.47.2` |
| `rg` | 설치됨 | `/opt/homebrew/bin/rg`, `ripgrep 14.1.1` |
| `fd` | 설치됨 | `/opt/homebrew/bin/fd`, `fd 10.2.0` |
| `http` / `httpie` | 설치됨 | `/opt/homebrew/bin/http`, `/opt/homebrew/bin/httpie`, `3.2.4` |
| `ast-grep` / `sg` | 미설치 | PATH에서 확인 안 됨 |
| `mdq` | 미설치 | PATH에서 확인 안 됨 |
| `just` | 미설치 | PATH에서 확인 안 됨 |
| `hyperfine` | 미설치 | PATH에서 확인 안 됨 |
| `sd` | 미설치 | PATH에서 확인 안 됨 |
| `jaq` / `gojq` | 미설치 | PATH에서 확인 안 됨 |
| `miller` / `mlr` | 미설치 | PATH에서 확인 안 됨 |
| `xh` | 미설치 | PATH에서 확인 안 됨 |
| `bat` | 미설치 | PATH에서 확인 안 됨 |

## 실행 검증 1: `jq` projection

입력 fixture:

```json
{"files":[{"path":"src/a.ts","symbols":["run","parse"]},{"path":"src/b.ts","symbols":["render"]}],"meta":{"total":2,"ignored":["dist/bundle.js"]}}
```

명령:

```bash
jq -c '{total:.meta.total, paths:[.files[].path]}' sample.json
```

출력:

```json
{"total":2,"paths":["src/a.ts","src/b.ts"]}
```

판정: CONFIRMED  
의미: wrapper가 full JSON 대신 필요한 record만 반환할 수 있다.

## 실행 검증 2: `yq` projection

입력 fixture:

```yaml
pipeline:
  steps:
    - name: scan
      tool: rg
    - name: project
      tool: jq
```

실패한 명령:

```bash
yq -o=json '.pipeline.steps[] | {name, tool}' sample.yml
```

출력:

```text
Error: 1:22: lexer: invalid input text "name, tool}"
```

성공한 명령:

```bash
yq -o=json '.pipeline.steps[] | {"name": .name, "tool": .tool}' sample.yml | jq -c .
```

출력:

```json
{"name":"scan","tool":"rg"}
{"name":"project","tool":"jq"}
```

판정: CONFIRMED WITH CAVEAT  
의미: `yq`는 강력하지만 jq와 완전 동일하지 않다. 모델이 expression을 즉석 작성하게 하지 말고 wrapper query catalog를 둬야 한다.

## 실행 검증 3: `rg --json` normalization

입력 fixture:

```ts
export function run() { return parse("x") }
export function parse(value: string) { return value.trim() }
export function render() { return "ok" }
```

명령:

```bash
rg --json 'function' src | jq -c 'select(.type=="match") | {path:.data.path.text,line:.data.line_number,text:.data.lines.text}'
```

출력:

```json
{"path":"/private/tmp/opencode-wrapper-verify-40451/src/a.ts","line":1,"text":"export function run() { return parse(\"x\") }\n"}
{"path":"/private/tmp/opencode-wrapper-verify-40451/src/a.ts","line":2,"text":"export function parse(value: string) { return value.trim() }\n"}
{"path":"/private/tmp/opencode-wrapper-verify-40451/src/b.ts","line":1,"text":"export function render() { return \"ok\" }\n"}
```

판정: CONFIRMED  
의미: `rg --json`은 wrapper가 path, line, text만 뽑아 evidence packet으로 만들 수 있다.

## 실행 검증 4: `fd` file discovery

명령:

```bash
fd -e ts . /private/tmp/opencode-wrapper-verify-40451
```

정규화 출력:

```text
src/a.ts
src/b.ts
```

판정: CONFIRMED  
의미: `fd`는 file candidate list를 간결하게 만들 수 있다.

## 미검증 항목

| 항목 | 사유 | 후속 검증 |
| --- | --- | --- |
| `ast-grep` search/rewrite | 로컬 미설치 | `sg run --json=stream` fixture 추가 |
| `sg outline` | 로컬 미설치 | TS/Rust/Python file outline fixture 추가 |
| `mdq` Markdown query | 로컬 미설치 | heading/task/link selector와 output format 검증 |
| `just` recipe catalog | 로컬 미설치 | `just --list`, recipe arg, PowerShell shell 설정 검증 |
| `hyperfine` benchmark | 로컬 미설치 | `rg` option 비교 fixture 검증 |
| `httpie` local endpoint | network/API probe 불필요 | localhost mock endpoint에서 JSON request/response 검증 |

## 검증 결론

현재 바로 실사용 가능한 wrapper 기반은 `jq`, `yq`, `rg`, `fd`다. 이 네 도구만으로도 JSON/YAML/text search/file discovery의 반복 부담을 크게 줄일 수 있다. `ast-grep`, `mdq`, `just`는 전략상 가치가 있지만 bootstrap/doctor와 fixture 검증 뒤에 P1/P2로 올리는 편이 안전하다.
