# OpenCode + Qwen 계열 small 모델 작업 분해 리서치

작성일: 2026-06-21  
원본 ultraresearch 저널: `.omo/ultraresearch/20260621-opencode-small-model-decomposition/`

## 결론

Qwen3.6 계열이나 Qwen3-Coder 계열 small-active-parameter 모델을 OpenCode에 연결하는 것은 가능하다. 다만 안정적인 운영 모델은 "작은 모델에게 큰 문제를 그대로 맡긴다"가 아니다. 안정적인 구조는 다음 세 계층으로 나뉜다.

1. OpenCode는 provider, model, permission, agent mode, MCP/tool 호출 권한을 제한한다.
2. Tiny-Chu 같은 workflow 계층은 큰 작업을 작은 packet으로 나누고, packet이 실행 가능한지 검증한다.
3. Tinker.Gen 같은 deterministic generation 계층은 모델 출력이 직접 파일을 덮어쓰지 못하게 preview/checkpoint/hash 검증 후 apply한다.

핵심은 `small_model`을 안전장치로 착각하지 않는 것이다. OpenCode의 `small_model`은 가벼운 작업을 더 싼 모델로 보내기 위한 selector이며, 안전 경계는 provider allow/deny, permission, agent mode, MCP enable/auth, tool permission, evidence gate, context budget gate 쪽에 있다.

## 운영 원칙

### 1. 모델은 prompt가 아니라 profile로 고정한다

small 모델을 쓸 때는 "Qwen 잘해줘" 같은 prompt가 아니라 아래 필드를 가진 실행 profile이 필요하다.

| 필드 | 목적 |
| --- | --- |
| `provider/model` | OpenCode에서 사용하는 provider-scoped model ID |
| `serving` | `vllm`, `sglang`, `llama.cpp`, `ollama`, OpenAI-compatible endpoint 등 |
| `toolParser` | Qwen tool use 시 `qwen3_coder` 같은 parser 지정 |
| `reasoningParser` | Qwen3.6 계열에서 필요한 경우 `qwen3` 지정 |
| `maxContextTokens` | 모델카드 숫자가 아니라 실제 runtime에서 검증한 입력 한도 |
| `fallbackContextTokens` | OOM 시 낮출 context, Qwen3-Coder 계열은 32768 기준 |
| `contextFloorTokens` | Qwen3.6-35B-A3B처럼 긴 context 유지가 권장되는 경우 최소선 |
| `allowedTools` | 해당 packet에서 허용할 tool allowlist |
| `escalation` | 반복 실패 시 stronger model 또는 human review로 넘기는 조건 |

모델카드의 262K 또는 1M context는 최대치이지 안전한 기본값이 아니다. Qwen 카드들은 OOM 시 context를 낮추라는 운영 지침을 포함하므로, 작은 모델에게 긴 context를 무조건 밀어 넣는 방식은 피해야 한다.

### 2. 큰 작업은 packet lifecycle로 처리한다

큰 문제는 아래 흐름으로 작게 자른다.

1. `discover`: 관련 파일, 테스트, 제약, 과거 결정, 실패 조건을 찾는다.
2. `packetize`: 목표, 파일 범위, 허용 tool, acceptance check, token estimate, stop rule을 가진 packet을 만든다.
3. `fit`: `context_budget_simulation`으로 packet이 모델 입력 예산에 맞는지 확인한다.
4. `execute`: plan/read-only agent 또는 좁은 write permission agent로 packet만 수행한다.
5. `observe`: build, test, lint, domain check를 실행한다.
6. `repair`: 테스트나 evidence 실패가 있을 때만 bounded retry를 수행한다.
7. `accept`: `evidence_gate`와 `workflow_sot_audit`를 통과해야 완료로 인정한다.
8. `resume`: compaction 또는 interruption 이후에는 `task_focus_packet` 같은 resume packet으로 이어간다.

이 흐름의 목적은 작은 모델을 똑똑하게 보이게 만드는 것이 아니라, 작은 모델이 잃어버릴 수 있는 상태와 판단을 시스템 밖에서 구조화하는 것이다.

## OpenCode에서 강제할 수 있는 것과 없는 것

### OpenCode가 강제할 수 있는 것

- `enabled_providers`, `disabled_providers`로 provider 노출 제한
- provider 범위 model ID와 custom OpenAI-compatible endpoint
- global permission과 agent별 permission
- `plan` agent와 `build` agent의 다른 permission envelope
- MCP server 활성화/비활성화, auth state, local/remote transport
- MCP/tool 호출 시 permission evaluation

### OpenCode만으로 부족한 것

- 어떤 작업을 small model에게 맡길지 결정
- 큰 문제를 충분히 작은 packet으로 자르는 것
- MCP/tool 표면을 task 단위로 최소화하는 것
- 모델카드의 context limit을 실제 runtime budget으로 바꾸는 것
- 반복 실패 시 escalation하는 정책
- evidence 없는 완료 주장을 막는 것

따라서 OpenCode는 control plane이고, small-model reliability는 workflow layer가 맡아야 한다.

## Qwen 모델 선택 기준

이번 리서치에서 bare `Qwen3.6`라는 공개 모델명은 확인하지 못했다. 공식 공개 근거는 suffix가 붙은 모델명 기준으로 잡는 것이 안전하다.

| 모델 | 리서치상 의미 | 주의점 |
| --- | --- | --- |
| `Qwen3-Coder-30B-A3B-Instruct` | 가장 작은 축의 공식 coding-agent 후보. 30.5B total, 3.3B activated, native 262K context. | non-thinking mode, OOM 시 32768 context fallback 필요. |
| `Qwen3-Coder-Next` | coding agent와 local development를 직접 겨냥한 모델. 80B total, 3B activated. | `qwen3_coder` tool parser와 최신 SGLang/vLLM 조건을 profile에 넣어야 한다. |
| `Qwen3.6-35B-A3B` | Qwen3.6 계열 공개 open-weight artifact. 35B total, 3B activated. | 262K context를 기본으로 보되, OOM 대응과 128K context floor를 profile에 반영해야 한다. |

모델카드의 agentic coding/tool-use 성능 주장은 공식 출처 기반으로 기록했지만, 이 로컬 환경에서 모델을 직접 실행해 벤치마크한 것은 아니다.

## Tiny-Chu 적용 모델

Tiny-Chu에는 이미 small-model survival loop에 필요한 핵심 primitive가 있다.

| Primitive | 역할 |
| --- | --- |
| `task_focus_packet` | compaction/reentry 이후 현재 task와 plan focus 복원 |
| `context_budget_simulation` | packet dispatch 전 token budget 확인 |
| `worker_packet_optimizer` | context 초과 packet 분할 |
| `tool_usage_plan` | bounded tool sequence 생성 |
| `workflow_progress_heartbeat` | 장기 작업의 정지/진행 상태 확인 |
| `evidence_gate` | build/test/evidence/check 상태를 pass/warning/fail로 집계 |
| `workflow_sot_audit` | 최종 답변이 workflow source-of-truth와 evidence에 맞는지 확인 |
| `small_model_replay` | 결정적 failure fixture를 재실행해 회귀 확인 |

추천 실행 순서는 다음과 같다.

```text
doctor/session_preflight
-> context_packet 또는 task_focus_packet
-> tool_usage_plan
-> context_budget_simulation
-> packet 실행
-> workflow_progress_heartbeat
-> evidence_gate
-> workflow_sot_audit
-> task_checkpoint 또는 workflow_close
```

## Tinker.Gen 적용 모델

Tinker.Gen의 역할은 small model이 직접 파일을 쓰지 못하게 하는 deterministic write boundary다.

```text
template-manifest
-> CreateAction[] + sourceRefs + sha256
-> preview
-> checkpoint
-> hash 검증된 create-only apply
```

이 구조가 중요한 이유는 다음과 같다.

- 모델 출력은 바로 target workspace에 쓰이지 않는다.
- preview와 checkpoint가 manifest hash와 action hash를 가진다.
- apply는 manifest/checkpoint/action hash가 맞지 않으면 거부한다.
- create-only이므로 기존 파일을 조용히 덮어쓰지 못한다.
- path escape, symlink parent, symlinked diagnostics target을 막는다.
- `sourceRefs`로 생성물의 근거를 추적할 수 있다.

Yeoman이나 React migration adapter는 이 boundary 위에 올라가야 한다. Yeoman이 직접 target project에 쓰는 방식은 small-model reliability 관점에서 피하는 것이 맞다.

## 권장 아키텍처

```text
OpenCode
  - provider/model routing
  - permission / agent mode / MCP gate
  - local Qwen endpoint 연결

Tiny-Chu
  - task packet 생성
  - context budget gate
  - tool usage plan
  - heartbeat / resume
  - evidence gate / SOT audit

Tinker.Gen
  - schema-first manifest
  - 결정적 preview/checkpoint
  - hash-validated apply

Stronger model 또는 human review
  - 반복 실패
  - 보안 민감 변경
  - multi-module 변경
  - executable validation 부재
```

## 검증 결과

### Tiny-Chu

```bash
npm test -- test/small-model-resilience.test.mjs
npm test -- test/small-model-reliability-workflow.test.mjs
npm test -- test/small-model-reliability-profile.test.mjs
```

결과:

- `test/small-model-resilience.test.mjs`: 27/27 pass
- `test/small-model-reliability-workflow.test.mjs`: 6/6 pass
- `test/small-model-reliability-profile.test.mjs`: 2/2 pass
- 각 실행에서 `npm run build`와 `npm run naming:check`도 통과

### Tinker.Gen

```bash
npm test -- generation.test.ts
```

결과:

- Vitest 1 file pass
- 12/12 tests pass
- preview/checkpoint/apply, hash validation, lock behavior, symlink safety, no-overwrite guarantee 확인

## 출처

### OpenCode

- OpenCode pinned source/docs: https://github.com/anomalyco/opencode/tree/d3bbfff826c58708bb55ef11737943436305da7b
- Provider allow/deny: https://github.com/anomalyco/opencode/blob/d3bbfff826c58708bb55ef11737943436305da7b/packages/opencode/src/provider/provider.ts#L1336-L1348
- `small_model` selector: https://github.com/anomalyco/opencode/blob/d3bbfff826c58708bb55ef11737943436305da7b/packages/opencode/src/provider/provider.ts#L1827-L1852
- Permission enforcement: https://github.com/anomalyco/opencode/blob/d3bbfff826c58708bb55ef11737943436305da7b/packages/opencode/src/permission/index.ts#L78-L118
- Built-in agents: https://github.com/anomalyco/opencode/blob/d3bbfff826c58708bb55ef11737943436305da7b/packages/opencode/src/agent/agent.ts#L117-L179

### Qwen

- `Qwen3-Coder-30B-A3B-Instruct`: https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct
- `Qwen3-Coder-Next`: https://huggingface.co/Qwen/Qwen3-Coder-Next
- `Qwen3.6-35B-A3B`: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
- Qwen3-Coder blog: https://qwenlm.github.io/blog/qwen3-coder/

### Decomposition / coding-agent evidence

- SWE-bench: https://arxiv.org/abs/2310.06770
- ReAct: https://arxiv.org/abs/2210.03629
- SWE-agent: https://arxiv.org/abs/2405.15793
- Plan-and-Solve: https://arxiv.org/abs/2305.04091
- Least-to-Most: https://arxiv.org/abs/2205.10625
- Decomposed Prompting: https://arxiv.org/abs/2210.02406
- PEARL: https://arxiv.org/abs/2305.14564
- Reflexion: https://arxiv.org/abs/2303.11366
- Self-Refine: https://arxiv.org/abs/2303.17651
- Tree of Thoughts: https://arxiv.org/abs/2305.10601
- Graph of Thoughts: https://arxiv.org/abs/2308.09687

## 남은 한계

- Qwen 모델을 이 로컬 환경에서 직접 실행하지 않았으므로, 모델카드의 coding/tool-use 성능 주장은 실행 검증이 아니라 공식 출처 기반 주장이다.
- OpenCode의 provider family별 `small_model` fallback 세부 차이는 이번 문서의 핵심 질문을 바꾸지 않아 추가 확장하지 않았다.
- Tinker.Gen에는 아직 실제 Yeoman/React migration adapter 구현이 없다. 현재 확인된 것은 그 adapter를 안전하게 올릴 수 있는 deterministic boundary다.
