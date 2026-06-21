# 추천 CLI Tool과 이유

## 최우선 추천

### `jq`

추천도: P0  
역할: JSON projection, filtering, count, 안정적인 compact output
로컬 상태: 설치됨, `jq-1.7.1`

추천 이유:

- JSON은 OpenCode config, package metadata, tool output, test report, evidence packet에서 가장 흔한 형식이다.
- `-c`, `-r`, `-S`, `--stream` 같은 옵션으로 context에 넣을 output을 강하게 줄일 수 있다.
- wrapper가 query catalog를 갖고 있으면 모델이 jq syntax를 직접 만들 필요가 없다.

사용 예:

```bash
jq -c -S '{scripts:(.scripts // {}), deps:(.dependencies // {} | keys)}' package.json
```

wrapper 이름:

- `helper_json_query`
- `helper_json_pick`
- `helper_json_count`

### Mike Farah `yq`

추천도: P0  
역할: YAML/JSON/TOML/XML/CSV 등 config query  
로컬 상태: 설치됨, `v4.47.2`

추천 이유:

- OpenCode, CI, package tooling은 JSON만 쓰지 않는다.
- Mike Farah `yq`는 single binary로 배포되고, jq-like query로 여러 format을 다룬다.
- 공식 문서 자체가 Docker/Podman wrapper function을 예시로 제시한다. 즉 wrapper로 CLI ceremony를 숨기는 패턴이 upstream에도 있다.

주의:

- jq와 완전히 동일한 syntax가 아니다.
- implementation이 여러 개라서 `mikefarah-v4`로 pin해야 한다.
- `-i` in-place update는 기본 helper에서 빼고 preview/apply 흐름으로 격리한다.

### `ripgrep` / `rg`

추천도: P0  
역할: ignore 규칙을 반영한 text evidence search
로컬 상태: 설치됨, `ripgrep 14.1.1`

추천 이유:

- `.gitignore`와 hidden/binary skip이 기본이라 repo scan에서 noise가 적다.
- `--json`으로 match 결과를 machine-readable event stream으로 받을 수 있다.
- `--sort path`, `--glob`, type filter, PCRE2, multiline 같은 고급 옵션을 wrapper가 안전하게 열 수 있다.

wrapper 이름:

- `helper_search_text`
- `helper_search_symbol_text`
- `helper_search_count`

### `fd`

추천도: P0  
역할: file discovery  
로컬 상태: 설치됨, `fd 10.2.0`

추천 이유:

- `find`보다 모델이 조합해야 할 syntax가 작다.
- 기본적으로 hidden/ignored path를 피한다.
- extension/type/root filtering을 명확히 제공한다.

주의:

- `fd -x`, `fd -X`는 action execution이므로 기본 read-only discovery helper에서는 제외한다.

## 구조적 코드 작업 추천

### `ast-grep` / `sg`

추천도: P1  
역할: AST structural search, lint, rewrite preview, outline  
로컬 상태: 미설치

추천 이유:

- regex 대신 code-shaped pattern을 쓴다.
- `$A`, `$$$ARGS` 같은 meta variable로 syntax node를 잡을 수 있다.
- JSON output과 stream output이 있어 helper output 정규화에 맞다.
- `sg outline` 설계는 interactive coding agent를 위한 compact code structure primitive로 직접 관련이 있다.

도입 조건:

- installer/doctor에서 `sg --version` 또는 `ast-grep --version` 확인.
- language별 지원 범위와 output format을 test fixture로 pin.
- rewrite는 preview-only helper부터 시작.

## Command catalog 추천

### `just`

추천도: P1  
역할: project-local command recipe catalog  
로컬 상태: 미설치

추천 이유:

- repo마다 다른 test/build/lint 명령을 recipe 이름으로 숨길 수 있다.
- `just --list`가 command catalog 역할을 한다.
- shell을 PowerShell 등으로 바꿀 수 있어 Windows/OpenCode 운용에도 맞다.

주의:

- build system이 아니라 command runner다.
- side effect 있는 recipe는 OpenCode permission에서 `ask`로 둔다.

## 선택 추천

### `mdq`

추천도: P2 optional  
역할: Markdown section/task/link/table/front matter query  
로컬 상태: 미설치

추천 이유:

- Markdown docs가 많은 repo에서는 heading 단위 query가 context를 크게 줄인다.
- `README.md` 전체를 읽지 않고 `# Usage`, task list, link list만 뽑는 wrapper가 가능하다.

주의:

- `yshavit/mdq`는 후보로 볼 수 있지만, 필수 도구로 올리기 전에 version pin과 output contract 검증이 필요하다.
- 현재 로컬 실행 검증은 없다.

### `hyperfine`

추천도: P2  
역할: command benchmark  
로컬 상태: 미설치

추천 이유:

- wrapper 후보의 성능 비교를 모델 판단이 아니라 실행 결과로 만들 수 있다.
- large repo에서 `rg` 옵션, `fd` 옵션, AST scan 옵션을 비교할 때 유용하다.

### `miller` / `mlr`

추천도: P2  
역할: CSV/TSV/JSONL/YAML record processing  
로컬 상태: 미설치

추천 이유:

- log, benchmark, table-shaped data를 다룰 때 `jq`보다 자연스럽다.
- OpenCode wrapper에서 test report나 benchmark CSV를 요약할 때 유용하다.

### `httpie` 또는 `xh`

추천도: P2  
역할: API request/response shaping  
로컬 상태: `http`/`httpie` 설치됨, `xh` 미설치

추천 이유:

- OpenAI-compatible local endpoint, OpenCode server, healthcheck API를 수동 `curl`보다 명확하게 호출할 수 있다.
- 단, network/API side effect가 있으므로 default helper에는 넣지 않고 diagnostics profile에서만 사용한다.

### `sd`

추천도: P3  
역할: clearer find/replace  
로컬 상태: 미설치

추천 이유:

- `sed`보다 regex/replace syntax가 직관적이다.

주의:

- code rewrite에는 `ast-grep` preview가 우선이다.
- text rewrite는 side effect가 커서 OpenCode helper 기본값으로는 추천하지 않는다.

### `gojq` / `jaq`

추천도: P3  
역할: jq alternative  
로컬 상태: 미설치

추천 이유:

- embedding, startup, portability 요구가 생기면 검토할 만하다.

주의:

- 기본 전략에서는 canonical `jq`를 우선한다.
- jq compatibility 차이를 다시 검증해야 한다.

## 제외 또는 보류

| Tool | 판단 | 이유 |
| --- | --- | --- |
| raw `grep` | 보류 | 기본 ubiquitous fallback이지만 repo search는 `rg`가 더 적합 |
| raw `find` | 보류 | edge-case traversal에는 필요하지만 모델 부담이 크다 |
| `sed -i` / `perl -pi` | 제외 | preview 없이 write side effect가 커서 small model에게 위험 |
| `curl` | 보류 | 가능하지만 JSON body/header quoting 부담이 커서 `httpie` wrapper가 낫다 |

## 최종 추천 세트

기본 bootstrap:

```text
jq
yq (Mike Farah v4)
rg
fd
```

강화 bootstrap:

```text
ast-grep 또는 sg
just
mdq (optional)
```

diagnostics bootstrap:

```text
hyperfine
miller
httpie 또는 xh
```
