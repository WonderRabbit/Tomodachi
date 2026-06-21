# Tomodachi Agent Integration Installation Guide

이 문서는 Tomodachi를 Claude Code, OpenCode, Codex와 연결하는 설치 및 운영 가이드다. 목표는 agent가 작업하는 동안 Tomodachi에 작업 context, 실행 결과, evidence, 상태 전이 요청을 안정적으로 보내고, Tomodachi가 이를 backend-owned data로 정규화해 UI와 audit/outbox에 노출하게 만드는 것이다.

> 파일명은 요청된 경로를 보존하기 위해 `docs/INSTAllATION.md`로 둔다.

## 1. 원칙

Tomodachi 연동은 agent별 adapter를 직접 DB에 붙이는 방식이 아니다. 모든 agent는 Tomodachi backend 또는 Tomodachi MCP facade만 호출한다.

```text
Claude Code / OpenCode / Codex
  -> local wrapper, skill, command, hook, or MCP client
  -> Tomodachi backend API or Tomodachi MCP facade
  -> TaskTransitionService, AgentRun, AuditEvent, OutboxEvent
  -> Tomodachi UI
```

필수 규칙:

1. Frontend는 agent tool을 직접 호출하지 않는다.
2. Agent는 Tomodachi DB에 직접 쓰지 않는다.
3. 상태 전이는 `TaskTransitionService`를 통해서만 수행한다.
4. 모든 write 요청은 `Authorization`, `idempotencyKey`, `correlationId`를 포함한다.
5. Agent가 보낸 raw session은 보관 대상이 아니라 정규화 입력이다. UI에는 backend가 정리한 summary, evidence, unresolved item만 보여준다.
6. MCP는 모든 backend endpoint를 노출하는 gateway가 아니라 작은 tool catalog로만 시작한다.

## 2. 현재 Tomodachi 연동 표면

현재 backend에는 OpenCode 이름으로 시작한 agent-facing endpoint가 있다. Claude Code와 Codex도 1차 연동에서는 같은 backend boundary를 재사용한다. 이 문서에서 "현재 사용 가능"이라고 표시한 절차만 바로 실행 가능한 절차이며, "다음 구현 단계"라고 표시한 절차는 backend endpoint나 MCP server를 추가한 뒤 적용한다.

| 목적 | Endpoint 또는 파일 | 설명 |
| --- | --- | --- |
| Task context 조회 | `GET /api/opencode/task-context/{taskId}` | task, project, status machine, artifact, agent run, rules를 compact context로 반환한다. |
| Tool catalog 조회 | `GET /api/mcp/tools` | `tomodachi.get_task_context`, `tomodachi.transition_task`를 노출한다. |
| Tool invoke | `POST /api/mcp/invoke` | `AGENT_SERVICE`만 호출 가능하다. |
| 상태 전이 | `TaskTransitionService.transition` | role guard, state machine, idempotency, audit/outbox 저장을 담당한다. |
| 검증 표면 | `backend/src/test/kotlin/com/tomodachi/backend/BackendApiIntegrationTest.kt` | agent context와 MCP-like invoke를 MockMvc로 검증한다. |

운영 이름은 다음처럼 통일한다.

```text
Integration protocol: tomodachi-agent.v1
MCP tool namespace:  tomodachi.*
Event namespace:     com.tomodachi.agent.*
Actor role:          AGENT_SERVICE
```

## 3. 공통 환경 변수

세 agent 모두 동일한 환경 변수를 사용한다.

```bash
export TOMODACHI_BASE_URL="http://127.0.0.1:8080"
export TOMODACHI_AGENT_TOKEN="<agent-service-access-token>"
export TOMODACHI_WORKSPACE_ID="workspace_core"
export TOMODACHI_PROTOCOL_VERSION="tomodachi-agent.v1"
```

Token은 `agent@tomodachi.local` 같은 `AGENT_SERVICE` 계정으로 발급한다. 개인 user token이나 admin token을 agent runtime에 넣지 않는다.

## 4. 공통 protocol format

Agent가 Tomodachi에 작업 결과를 보낼 때는 아래 envelope를 사용한다. HTTP request body, MCP tool argument, hook payload에서 같은 형태를 유지한다.

```json
{
  "protocolVersion": "tomodachi-agent.v1",
  "source": {
    "agentHost": "opencode",
    "sessionId": "session_20260621_001",
    "workspace": "workspace_core",
    "repo": "Tomodachi"
  },
  "correlationId": "corr_task_seed_ready_session_001",
  "idempotencyKey": "task_seed_ready:session_001:completed",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
  "taskId": "task_seed_ready",
  "event": {
    "type": "com.tomodachi.agent.run.completed.v1",
    "time": "2026-06-21T13:00:00Z"
  },
  "agentRun": {
    "provider": "OpenCode",
    "model": "qwen3-coder",
    "agentName": "task-implementation",
    "status": "ReviewRequired",
    "summary": "Implemented task transition guard and captured verification evidence.",
    "changedFiles": [
      "backend/src/main/kotlin/com/tomodachi/backend/service/TaskTransitionService.kt"
    ],
    "evidence": [
      {
        "kind": "test",
        "path": "backend/build/test-results/test/TEST-com.tomodachi.backend.BackendApiIntegrationTest.xml",
        "summary": "MockMvc transition tests passed."
      }
    ],
    "unresolved": [
      {
        "severity": "review",
        "message": "Confirm production outbox worker retry policy."
      }
    ]
  }
}
```

필수 field:

| Field | 필수 이유 |
| --- | --- |
| `protocolVersion` | wrapper와 backend validator가 schema version을 판단한다. |
| `source.agentHost` | `claude-code`, `opencode`, `codex`를 구분한다. |
| `correlationId` | 한 task에서 context 조회, run 기록, 상태 전이를 묶는다. |
| `idempotencyKey` | 재시도 시 중복 상태 전이와 중복 evidence 저장을 막는다. |
| `traceparent` | OpenTelemetry trace 연결을 위한 표준 field다. |
| `taskId` | Tomodachi task aggregate key다. |
| `event.type` | event routing과 outbox topic을 결정한다. |

권장 event type:

```text
com.tomodachi.agent.run.started.v1
com.tomodachi.agent.run.completed.v1
com.tomodachi.agent.run.failed.v1
com.tomodachi.agent.evidence.attached.v1
com.tomodachi.task.transition.requested.v1
com.tomodachi.protocol.capabilities.changed.v1
```

## 5. 공통 MCP tool catalog

처음부터 많은 tool을 열지 않는다. 세 agent 모두 아래 4개만 공유한다.

| Tool | Input | Output | Write 여부 |
| --- | --- | --- | --- |
| `tomodachi.get_task_context` | `{ "taskId": "..." }` | compact task context | read |
| `tomodachi.record_agent_event` | protocol envelope | accepted event id | write |
| `tomodachi.transition_task` | `{ "taskId", "toStatus", "reason", "idempotencyKey" }` | transition response | write |
| `tomodachi.attach_evidence` | `{ "taskId", "runId", "evidence[]" }` | evidence ids | write |

현재 repo에는 `get_task_context`와 `transition_task`만 존재한다. `record_agent_event`와 `attach_evidence`는 다음 구현 단계에서 추가한다. 따라서 현재 실행 예시는 `/api/mcp/tools`와 `/api/mcp/invoke`만 사용한다.

## 6. Claude Code 연동

Claude Code는 project instruction, `CLAUDE.md` memory, settings, MCP, hooks, skills를 조합한다. 공식 문서 기준으로 Claude Code는 terminal, IDE, desktop, browser에서 코드베이스를 읽고 파일을 수정하며 command를 실행할 수 있고, MCP로 외부 tool과 data source에 연결할 수 있다.

### 6.1 설치

macOS, Linux, WSL:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://claude.ai/install.ps1 | iex
```

설치 후 Tomodachi repo에서 실행한다.

```bash
cd /path/to/Tomodachi
claude
```

### 6.2 Project memory 작성

Claude Code가 매 session 시작 시 읽도록 repo root에 `CLAUDE.md`를 둔다. Tomodachi repo에 commit할지 여부는 팀 정책에 따른다.

```md
# Tomodachi Claude Code Rules

- Frontend must not call agent tools directly.
- Agent data must be sent to Tomodachi backend or Tomodachi MCP facade.
- Never write directly to the Tomodachi database.
- Use `TOMODACHI_BASE_URL` and `TOMODACHI_AGENT_TOKEN` for agent-service calls.
- Use `idempotencyKey` for every transition or evidence write.
- Before changing task state, call `tomodachi.get_task_context`.
```

### 6.3 현재 사용 가능한 연결 방식

현재 Tomodachi backend는 full MCP server endpoint인 `/mcp`를 제공하지 않는다. 지금은 Claude Code에서 local wrapper command를 호출하고, wrapper가 Tomodachi의 기존 HTTP facade인 `/api/mcp/tools`와 `/api/mcp/invoke`를 호출하게 한다.

Tool catalog 확인:

```bash
curl -sS \
  -H "Authorization: Bearer ${TOMODACHI_AGENT_TOKEN}" \
  "${TOMODACHI_BASE_URL}/api/mcp/tools"
```

Task context 조회 wrapper 예시:

```bash
curl -sS \
  -H "Authorization: Bearer ${TOMODACHI_AGENT_TOKEN}" \
  "${TOMODACHI_BASE_URL}/api/opencode/task-context/${TOMODACHI_TASK_ID}"
```

Claude Code에는 이 wrapper를 command, hook, 또는 MCP stdio server로 감싼 뒤 붙인다. 예를 들어 `scripts/tomodachi-mcp-server.mjs`가 Tomodachi HTTP facade를 MCP protocol로 변환한다면 다음처럼 등록한다.

```bash
claude mcp add --scope project tomodachi -- node scripts/tomodachi-mcp-server.mjs
```

권장 scope:

| Scope | 용도 |
| --- | --- |
| local | 개인 실험, token이 local에만 있어야 하는 경우 |
| project | Tomodachi repo 팀 표준으로 공유할 경우 |
| user | 여러 repo에서 같은 Tomodachi instance를 쓰는 개인 환경 |

### 6.4 Hook 설계

Claude Code hook은 agent action 전후에 wrapper script를 실행하는 데 쓴다. 권장 hook은 3개다.

| Hook | 역할 |
| --- | --- |
| session start | `TOMODACHI_BASE_URL`, token 존재 여부 확인 |
| post tool use | 변경 파일, test 결과, unresolved item summary 전송 |
| stop | final run summary와 evidence 전송 |

Wrapper command 예시:

```bash
node scripts/tomodachi-agent-event.mjs \
  --host claude-code \
  --task "$TOMODACHI_TASK_ID" \
  --event com.tomodachi.agent.run.completed.v1
```

### 6.5 Claude Code 운영 절차

1. Tomodachi UI에서 task를 선택한다.
2. `TOMODACHI_TASK_ID`를 shell에 설정한다.
3. Claude Code session을 시작한다.
4. Claude가 먼저 `tomodachi.get_task_context`를 호출해 backend-owned context를 받는다.
5. 현재 단계에서는 작업 중 evidence를 local run summary로 남긴다. `tomodachi.attach_evidence`는 다음 구현 단계에서 backend endpoint를 추가한 뒤 사용한다.
6. 상태 변경이 필요하면 `tomodachi.transition_task`만 사용한다.
7. session 종료 시 hook 또는 수동 command로 `agent.run.completed`를 기록한다.

## 7. OpenCode 연동

OpenCode는 `opencode.json`, `.opencode/commands`, `.opencode/tools`, `.opencode/agents`, `.opencode/skills`, plugin, MCP server를 조합한다. OpenCode 공식 config는 JSON/JSONC를 지원하고 project config, `.opencode` directory, inline config 등의 precedence를 가진다.

### 7.1 현재 사용 가능한 Project config

Repo root에 `opencode.jsonc`를 둔다.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "read": "allow",
    "grep": "allow",
    "glob": "allow",
    "tomodachi.get_task_context": "allow",
    "tomodachi.transition_task": "ask",
    "bash": {
      "*": "ask",
      "git status*": "allow",
      "rg *": "allow",
      "rm *": "deny",
      "git push*": "ask"
    }
  }
}
```

Full MCP server를 아직 만들지 않은 현재 단계에서는 OpenCode custom tool이 `/api/mcp/invoke`를 직접 호출하거나, local stdio wrapper인 `scripts/tomodachi-mcp-server.mjs`를 통해 기존 HTTP facade를 MCP tool처럼 노출한다. Native remote MCP config는 Tomodachi가 `/mcp` 같은 MCP endpoint를 구현한 뒤 추가한다.

### 7.2 Custom command

`.opencode/commands/tomodachi-sync.md`:

```md
---
description: Load Tomodachi task context and keep task evidence synchronized.
argument-hint: TASK_ID
---

Use `tomodachi.get_task_context` for `$ARGUMENTS`.
Summarize the task, constraints, status machine, linked artifacts, and prior agent runs.
Do not call Tomodachi database directly.
For every state-changing request, use `idempotencyKey`.
```

OpenCode helper tool 이름은 기존 research contract와 맞춘다.

| Helper | Tomodachi에서의 용도 |
| --- | --- |
| `helper_find_files` | task 관련 파일 후보를 좁힌다. |
| `helper_search_text` | evidence, endpoint, status enum 사용처를 찾는다. |
| `helper_json_query` | `opencode.jsonc`, schema, event fixture를 검사한다. |
| `helper_yaml_query` | AsyncAPI 또는 workflow YAML을 검사한다. |
| `helper_ast_search` | Kotlin/TypeScript symbol을 구조적으로 찾는다. |

### 7.3 현재 사용 가능한 Custom tool

현재 backend에 존재하는 tool인 `tomodachi.get_task_context`를 호출하는 custom tool 예시다.

```ts
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Read backend-owned Tomodachi task context.",
  args: {
    taskId: tool.schema.string(),
  },
  async execute(args, context) {
    const response = await fetch(`${process.env.TOMODACHI_BASE_URL}/api/mcp/invoke`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.TOMODACHI_AGENT_TOKEN}`,
      },
      body: JSON.stringify({
        name: "tomodachi.get_task_context",
        arguments: {
          taskId: args.taskId,
        },
      }),
    })

    return {
      ok: response.ok,
      status: response.status,
      source: {
        agentHost: "opencode",
        sessionId: context.sessionID,
        worktree: context.worktree,
      },
      body: await response.text(),
    }
  },
})
```

`tomodachi.transition_task`도 현재 사용할 수 있지만 write tool이므로 기본 permission은 `ask`로 둔다. `record_agent_event`와 `attach_evidence` custom tool은 `/api/agent-events` 또는 별도 evidence endpoint를 구현한 뒤 추가한다. 그 future payload에는 `traceparent`, `correlationId`, `idempotencyKey`를 반드시 포함한다.

Tool 구현 규칙:

1. `context.worktree` 밖의 파일을 읽지 않는다.
2. shell string 대신 structured API 또는 argv array를 사용한다.
3. stdout/stderr, response body는 byte cap을 둔다.
4. `ok:false` 응답도 모델에게 숨기지 않는다.
5. write tool은 기본 `ask` permission으로 둔다.

### 7.4 OpenCode agent profile

`.opencode/agents/tomodachi-review.md`:

```md
---
description: Review Tomodachi tasks using backend-owned task context and evidence.
model: anthropic/claude-sonnet-4-5
---

Before reviewing, call `tomodachi.get_task_context`.
Only use Tomodachi MCP tools for task state changes.
Do not write directly to the database.
Return unresolved evidence as structured bullets.
```

### 7.5 OpenCode 운영 절차

1. `opencode.jsonc`에서 Tomodachi MCP server를 활성화한다.
2. `opencode debug config`로 config merge 결과를 확인한다.
3. `/tomodachi-sync task_seed_ready`로 context를 로드한다.
4. 작업 agent는 필요한 파일 변경과 test를 수행한다.
5. 현재 단계에서는 custom tool output과 local run summary에 evidence를 남긴다. `tomodachi.attach_evidence`는 다음 구현 단계에서 backend endpoint를 추가한 뒤 사용한다.
6. 상태 변경은 `tomodachi.transition_task`로만 수행한다.
7. 작업 종료 시 `agent.run.completed` 또는 `agent.run.failed`를 기록한다.

## 8. Codex 연동

Codex는 `AGENTS.md`, skills, MCP, hooks, plugins, subagents, `codex exec`를 조합한다. 공식 Codex manual 기준으로 `AGENTS.md`는 repo 지침, skills는 재사용 workflow, MCP는 외부 도구 연결, hooks는 agent lifecycle script, plugins는 skills/apps/MCP bundle, subagents는 병렬 specialized work에 적합하다.

### 8.1 Repo instruction

Codex가 이 파일만 읽어도 Tomodachi boundary를 알 수 있도록, 이 guide는 다음 규칙을 자체적으로 포함한다. 별도 `AGENTS.md`가 추적되지 않은 workspace에만 존재할 수 있으므로 committed guide가 그 파일에 의존하면 안 된다.

```md
- 프런트에서 OpenCode나 agent tool을 직접 호출하지 않는다.
- agent data는 백엔드가 소유하고 정규화한 summary만 표시한다.
- agent tool 구현은 scoped backend service를 거쳐야 하며 direct database access를 새 경로로 만들지 않는다.
```

Codex 전용 추가 지침이 필요하면 추적되는 `AGENTS.md` 또는 하위 `AGENTS.md`에 다음을 추가한다.

```md
## Agent integration

- Use Tomodachi MCP tools for task context, evidence, and transition writes.
- Include `idempotencyKey`, `correlationId`, and `traceparent` in every write payload.
- Prefer `tomodachi.get_task_context` before editing task-related code.
- Never expose `TOMODACHI_AGENT_TOKEN` in commits, logs, or final messages.
```

### 8.2 현재 사용 가능한 Codex MCP 설정

Codex는 `~/.codex/config.toml` 또는 trusted project의 `.codex/config.toml`에서 MCP server를 설정한다. 현재 Tomodachi backend에는 full MCP endpoint가 없으므로 HTTP remote MCP 설정을 바로 쓰지 않는다. 먼저 local stdio wrapper가 Tomodachi의 `/api/mcp/tools`와 `/api/mcp/invoke`를 MCP protocol로 변환하게 한다.

현재 단계의 local stdio wrapper:

```toml
[mcp_servers.tomodachi]
command = "node"
args = ["scripts/tomodachi-mcp-server.mjs"]
env_vars = ["TOMODACHI_BASE_URL", "TOMODACHI_AGENT_TOKEN", "TOMODACHI_WORKSPACE_ID"]
enabled = true
enabled_tools = ["tomodachi.get_task_context", "tomodachi.transition_task"]
default_tools_approval_mode = "prompt"
```

Tomodachi가 `/mcp` 같은 streamable HTTP MCP endpoint를 구현한 뒤에만 아래 형태로 전환한다.

```toml
[mcp_servers.tomodachi]
url = "http://127.0.0.1:8080/mcp"
bearer_token_env_var = "TOMODACHI_AGENT_TOKEN"
enabled = true
enabled_tools = ["tomodachi.get_task_context", "tomodachi.transition_task"]
default_tools_approval_mode = "prompt"
tool_timeout_sec = 45
```

검증:

```bash
codex mcp --help
codex exec --sandbox read-only "Read docs/INSTAllATION.md and list the currently available Tomodachi tools: /api/mcp/tools, /api/mcp/invoke, and /api/opencode/task-context/{taskId}."
```

### 8.3 Codex skill

Repo-scoped skill은 `.agents/skills/tomodachi-task/SKILL.md`에 둔다.

```md
---
name: tomodachi-task
description: Use when working on a Tomodachi task that needs backend-owned task context, evidence sync, or task transition.
---

1. Read Tomodachi task context through `tomodachi.get_task_context`.
2. Keep edits inside the repository scope requested by the task.
3. Capture verification evidence before recording completion.
4. Keep test, diff, and review evidence in the local run summary until `tomodachi.attach_evidence` is implemented.
5. Use `tomodachi.transition_task` only with an explicit `idempotencyKey`.
6. Never call the Tomodachi database directly.
```

### 8.4 Codex hook

Project `.codex/hooks.json` 예시:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/tomodachi-agent-event.mjs --host codex --event com.tomodachi.agent.run.completed.v1",
            "timeout": 30,
            "statusMessage": "Recording Tomodachi agent run"
          }
        ]
      }
    ]
  }
}
```

Hook은 trust review 대상이다. Project-local hook을 쓰는 경우 Codex에서 `/hooks`로 source와 command를 검토한 뒤 신뢰한다.

### 8.5 Codex noninteractive mode 실행

CI나 scheduled job에서 Codex를 실행할 때는 `codex exec`를 쓴다. Codex manual의 noninteractive mode는 script나 CI에서 TUI 없이 Codex를 실행하는 표면이므로 Tomodachi evidence sync 자동화에 적합하다.

```bash
TOMODACHI_TASK_ID=task_seed_ready \
TOMODACHI_BASE_URL=http://127.0.0.1:8080 \
codex exec --sandbox workspace-write \
  "Use the tomodachi-task skill. Load task context, implement the requested change, run verification, summarize evidence locally, and do not transition the task without explicit approval."
```

`codex exec` automation에서는 token 노출을 줄이기 위해 `TOMODACHI_AGENT_TOKEN`을 단일 invocation 환경에만 주입한다. CI job 전체 환경 변수로 두지 않는다.

### 8.6 Codex subagent 운영

복잡한 Tomodachi task는 subagent를 역할별로 나눈다.

| Agent | 역할 | Tool policy |
| --- | --- | --- |
| `tomodachi-explorer` | task context, linked artifact, prior run 읽기 | read-only |
| `tomodachi-implementer` | 코드 변경과 test | workspace-write, write tool ask |
| `tomodachi-reviewer` | diff와 evidence audit | read-only |
| `tomodachi-qa` | HTTP/tmux/browser QA evidence | bounded command allowlist |

Subagent가 많아질수록 token과 latency 비용이 증가하므로, task가 작으면 단일 Codex session과 `tomodachi-task` skill만 사용한다.

## 9. Tomodachi backend 확장 순서

현재 endpoint를 바로 production protocol로 확장하지 말고 아래 순서로 진행한다.

### 9.1 DTO 보강

현재 `McpInvokeRequest.arguments`가 `Map<String, String>`이라 nested evidence나 JSON envelope를 받기 어렵다. 다음 단계에서 structured JSON으로 바꾼다.

```kotlin
data class McpInvokeRequest(
    val name: String,
    val arguments: JsonNode,
)
```

### 9.2 Event ingest API 추가

권장 endpoint:

```text
POST /api/agent-events
Authorization: Bearer <AGENT_SERVICE token>
Idempotency-Key: <same as body.idempotencyKey>
Content-Type: application/json
```

처리 순서:

1. Bearer token을 `AGENT_SERVICE`로 인증한다.
2. `protocolVersion`을 검증한다.
3. `idempotencyKey` 중복을 검사한다.
4. `taskId` 존재 여부를 확인한다.
5. `agentRun`, evidence, unresolved item을 정규화한다.
6. `AuditEvent`와 `OutboxEvent`를 같은 transaction에서 저장한다.
7. 중복 요청이면 기존 accepted event id를 반환한다.

### 9.3 Outbox payload 보강

`db/init.sql`의 outbox payload가 작은 문자열이면 agent event payload를 담기 어렵다. JSON 또는 TEXT 계열로 확장한다.

```sql
ALTER TABLE outbox_event
  ALTER COLUMN payload TYPE TEXT;
```

Production PostgreSQL에서는 `JSONB`를 우선 검토한다.

### 9.4 Schema source of truth

`docs/protocol/tomodachi-agent.v1.schema.json`을 source of truth로 두고 backend test, wrapper test, MCP server test가 같은 schema를 사용하게 한다.

권장 산출물:

```text
docs/protocol/tomodachi-agent.v1.schema.json
docs/protocol/tomodachi-agent.v1.asyncapi.yaml
docs/protocol/examples/agent-run-completed.json
```

## 10. Wrapper 관리 방안

Wrapper는 agent별로 따로 만들되 output format은 공유한다.

```text
scripts/
  tomodachi-agent-event.mjs
  tomodachi-mcp-server.mjs
  tomodachi-validate-envelope.mjs
```

역할:

| Wrapper | 역할 |
| --- | --- |
| `tomodachi-agent-event.mjs` | Claude Code hook, Codex hook, OpenCode custom tool에서 공통 event 전송 |
| `tomodachi-mcp-server.mjs` | Claude Code/Codex/OpenCode가 붙는 local MCP server |
| `tomodachi-validate-envelope.mjs` | schema validation, required field, idempotency key shape 검사 |

Wrapper 원칙:

1. HTTP client timeout을 둔다.
2. retry는 idempotent write에만 허용한다.
3. token은 env에서만 읽고 log에 출력하지 않는다.
4. response body는 size cap을 둔다.
5. 실패하면 agent에게 `ok:false`, status code, retry 가능 여부를 반환한다.
6. wrapper는 DB driver를 포함하지 않는다.

## 11. 검증 절차

### 11.1 Backend

```bash
cd backend
./gradlew test
```

확인할 항목:

1. `AGENT_SERVICE`는 task context를 읽을 수 있다.
2. viewer는 MCP invoke를 호출할 수 없다.
3. `transition_task`는 state machine과 idempotency rule을 통과한다.
4. invalid transition은 `INVALID_TRANSITION`으로 거부된다.

### 11.2 OpenCode

```bash
opencode debug config
opencode run "/tomodachi-sync task_seed_ready"
```

Pass 기준:

1. Tomodachi MCP server가 enabled 상태다.
2. `tomodachi.get_task_context`가 allow다.
3. write tool은 ask 또는 prompt approval이다.
4. task context에 `rules`와 `statusMachine`이 포함된다.

### 11.3 Claude Code

```bash
claude mcp list
claude "Use Tomodachi MCP to summarize task_seed_ready without changing state."
```

Pass 기준:

1. Tomodachi MCP server가 list에 보인다.
2. read-only prompt에서 상태 전이 요청이 발생하지 않는다.
3. 응답이 Tomodachi backend context를 기준으로 한다.

### 11.4 Codex

```bash
codex mcp --help
codex exec --sandbox read-only "Summarize Tomodachi task integration rules from docs/INSTAllATION.md."
```

Pass 기준:

1. Codex가 이 문서의 backend/MCP boundary를 반영한다.
2. 직접 DB write 금지를 언급한다.
3. MCP 또는 backend boundary를 통해서만 write하라고 답한다.

## 12. Troubleshooting

| 증상 | 확인 | 조치 |
| --- | --- | --- |
| Agent가 403을 받음 | token role | `AGENT_SERVICE` token인지 확인한다. |
| 상태 전이가 409를 반환 | state machine 또는 idempotency | task 현재 status와 `idempotencyKey` 재사용 여부를 확인한다. |
| MCP tool이 너무 많이 보임 | tool catalog | `enabled_tools` allowlist로 줄인다. |
| Evidence가 중복 저장됨 | idempotency | `taskId:sessionId:eventType` 형태의 key를 사용한다. |
| Hook이 실행되지 않음 | trust 설정 | Claude Code/Codex hook trust UI에서 source와 command를 승인한다. |
| OpenCode가 project config를 못 읽음 | config precedence | `opencode debug config`로 merge 결과와 `.opencode` directory 위치를 확인한다. |
| Codex automation에서 token이 노출될 위험 | CI env scope | `CODEX_API_KEY`, `TOMODACHI_AGENT_TOKEN`을 단일 command 환경에만 주입한다. |

Backend error code 기준:

| Code | 의미 | 조치 |
| --- | --- | --- |
| `FORBIDDEN` | viewer 또는 일반 user가 agent-only invoke를 호출했다. | `AGENT_SERVICE` token으로 재시도한다. |
| `BAD_REQUEST` | `taskId`, `toStatus`, `reason` 같은 필수 argument가 없다. | wrapper schema validation을 추가한다. |
| `UNKNOWN_TOOL` | `/api/mcp/invoke`에 등록되지 않은 tool name이다. | `/api/mcp/tools` 결과와 tool name을 맞춘다. |
| `INVALID_TRANSITION` | state machine이 허용하지 않는 상태 변경이다. | 먼저 `tomodachi.get_task_context`로 현재 status와 허용 전이를 확인한다. |
| `IDEMPOTENCY_CONFLICT` | 같은 `idempotencyKey`가 다른 aggregate에서 재사용됐다. | key를 `taskId:sessionId:eventType`처럼 aggregate-bound로 만든다. |

## 13. Production 전환 체크리스트

- [ ] `record_agent_event`, `attach_evidence` backend endpoint를 구현한다.
- [ ] `McpInvokeRequest.arguments`를 structured JSON으로 바꾼다.
- [ ] Outbox payload column을 `TEXT` 또는 `JSONB`로 확장한다.
- [ ] `tomodachi-agent.v1.schema.json`을 추가하고 test에서 검증한다.
- [ ] Claude Code, OpenCode, Codex wrapper가 같은 schema fixture를 통과한다.
- [ ] Write tool은 기본 approval required로 둔다.
- [ ] Token, trace, idempotency 누락 요청은 400으로 거부한다.
- [ ] UI에는 raw payload가 아니라 normalized summary/evidence/unresolved count만 노출한다.

## 14. 참고한 공식 문서

- Claude Code overview: https://code.claude.com/docs/en/overview
- Claude Code MCP: https://code.claude.com/docs/en/mcp
- OpenCode config: https://opencode.ai/docs/config/
- OpenCode plugins: https://opencode.ai/docs/plugins/
- OpenCode custom tools: https://opencode.ai/docs/custom-tools/
- OpenCode MCP servers: https://opencode.ai/docs/mcp-servers/
- OpenCode agents: https://opencode.ai/docs/agents/
- OpenCode commands: https://opencode.ai/docs/commands/
- Codex manual: https://developers.openai.com/codex/codex-manual.md
- Model Context Protocol: https://modelcontextprotocol.io/specification/2025-06-18
