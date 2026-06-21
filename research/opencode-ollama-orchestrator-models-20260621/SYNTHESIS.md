# 울트라리서치 종합: OpenCode Orchestrator Agent용 Ollama 18GB 미만 모델

작업자: 4 · Wave: 3 · 출처: 18 · 검증: 1

## 요약

기본 추천은 **`devstral:24b`**다. OpenCode task-management/orchestrator agent에 가장 잘 맞는다. software-engineering agent를 목표로 만든 모델이고, Ollama 기준 **14GB**로 조건에 들어오며, **128K** context를 지원하고, Ollama/Mistral 자료에서 **46.8% SWE-bench Verified** 근거를 제시한다. 출처: [Ollama Devstral](https://ollama.com/library/devstral), [Mistral Devstral blog](https://mistral.ai/news/devstral).

가장 좋은 대안은 **`mistral-small3.1:24b` 또는 `mistral-small3.2:24b`**다. Devstral보다 code-agent 특화도는 낮지만, agent/function-calling 포지셔닝이 강하고, 현재 Ollama listing 기준 3.1/3.2 모두 **128K** context 축에 있으며, Mistral ecosystem 및 Apache 계열 라이선스 측면에서도 운용성이 좋다. 출처: [Ollama mistral-small](https://ollama.com/library/mistral-small), [OpenCode models docs](https://opencode.ai/docs/models/).

작고 안전한 fallback은 **`qwen3:14b`**다. tool use와 reasoning을 repository repair 특화보다 더 중시하면 이쪽이 낫다. 반대로 code repair/generation을 OpenCode 권장 long-context profile보다 더 중시하면 **`qwen2.5-coder:14b`**가 더 맞다. `qwen3-coder:30b`가 더 직접적인 후보지만 Ollama listed size가 **19GB**라서 사용자의 엄격한 **18GB 미만** 조건에서는 제외된다. 출처: [Ollama Qwen3](https://ollama.com/library/qwen3), [Ollama Qwen3-Coder](https://ollama.com/library/qwen3-coder), [Ollama Qwen2.5-Coder](https://ollama.com/library/qwen2.5-coder).

## 점수 기준

- Agentic coding 및 orchestration 근거: 25
- OpenCode/Ollama 기준 context 운용 가능성: 20
- 도구/함수/구조화 출력 적합도: 15
- 18GB 미만 VRAM headroom: 15
- 지시 이행 및 계획 안정성: 15
- License/ecosystem 성숙도: 10

## 비교표

| 순위 | 모델 | Ollama 크기 | Listed context | 적합도 점수 | 판단 |
|---:|---|---:|---:|---:|---|
| 1 | `devstral:24b` | 14GB | 128K | 89 | OpenCode coding-agent orchestration 기본값으로 가장 적합 |
| 2 | `mistral-small3.1/3.2:24b` | 15GB | 128K | 86 | general agent/function-calling 대안으로 가장 적합 |
| 3 | `qwen3:14b` | 9.3GB | 40K | 80 | tool/reasoning fallback은 강하지만 OpenCode 64K 권장에는 미달 |
| 4 | `llama3.1:8b` | 4.9GB | 128K | 79 | VRAM headroom은 가장 안전하나 coding-agent 특화도는 낮음 |
| 5 | `deepseek-v2:16b` | 8.9GB | 160K | 78 | long-context 가치는 크지만 OpenCode/tool 직접 근거는 약함 |
| 6 | `qwen2.5-coder:14b` | 9.0GB | 32K | 78 | code repair/generation은 강하지만 long-context orchestration 적합도는 낮음 |
| 7 | `magistral:24b` | 14GB | 39K listed | 76 | planner/reasoner로 강하지만 context 권장이 제약 |
| 8 | `codestral:22b` | 13GB | 32K | 62 | 좋은 code model이지만 task orchestrator 최상위 후보는 아님 |
| 9 | `gemma3:27b` | 17GB | 128K | 61 | listed size로는 맞지만 VRAM 여유와 coding-agent 근거가 부족 |
| 10 | `phi4:14b` | 9.1GB | 16K | 57 | reasoning model이지만 짧은 context가 OpenCode orchestration에 불리 |
| 11 | `starcoder2:15b` | 9.1GB | 16K | 53 | code 특화이나 older/short-context/instruction 한계가 있음 |
| 12 | `granite-code:20b` | 12GB | 8K | 46 | code 특화에도 불구하고 orchestrator fit은 약함 |

## Devstral이 1순위인 이유

OpenCode의 agent 문서를 보면 목표 모델 요구사항이 분명하다. orchestrator는 planning, delegation, 안전한 tool 사용, subagent 기반 codebase exploration을 처리해야 한다. OpenCode에는 `plan`, `build`, `general`, `explore`, `scout` agent role이 있고, agent별 model 및 permission 설정이 가능하다. 출처: [OpenCode agents](https://opencode.ai/docs/agents/), [OpenCode permissions](https://opencode.ai/docs/permissions/).

Ollama의 OpenCode integration 문서는 OpenCode에 더 큰 context window가 필요하며 최소 **64k tokens**를 권장한다고 설명한다. 동시에 Ollama는 **24 GiB VRAM 미만**에서는 기본값이 **4k context**라고 문서화한다. 따라서 모델 파일 크기만 맞는 후보는 long-context orchestration 관점에서 감점해야 한다. 출처: [Ollama OpenCode integration](https://docs.ollama.com/integrations/opencode), [Ollama context length](https://docs.ollama.com/context-length).

Devstral은 tool 사용, codebase exploration, multi-file editing을 수행하는 coding-agent model로 명시적으로 포지셔닝되어 있다. Ollama 기준 **14GB**, **128K** context, Apache 2.0, SWE-bench Verified 근거를 갖는다. 출처: [Ollama Devstral](https://ollama.com/library/devstral).

## 제외 및 caveat

- **`qwen3-coder:30b`는 제외**: 적합도는 높지만 Ollama listed size가 **19GB**라서 사용자의 18GB 미만 cutoff를 넘는다. 출처: [Ollama Qwen3-Coder](https://ollama.com/library/qwen3-coder).
- **30B MoE가 자동으로 저렴한 것은 아님**: Qwen3-30B-A3B도 Ollama에서는 **19GB**로 나타난다. active parameters와 loaded VRAM은 다르다. 출처: [Ollama Qwen3](https://ollama.com/library/qwen3).
- **광고된 context는 공짜가 아님**: Ollama는 더 큰 context가 더 많은 memory를 요구한다고 설명하며, `ollama ps`로 GPU offload를 확인하라고 권장한다. 출처: [Ollama context length](https://docs.ollama.com/context-length).
- **Benchmark는 orchestration을 완전히 대변하지 않음**: SWE-bench와 Aider는 edit-loop 능력을 proxy하고, BFCL은 tool calling을 더 잘 포착한다. HumanEval/MBPP만으로 이 결정을 내려서는 안 된다. 출처: [SWE-bench](https://www.swebench.com/), [Aider leaderboards](https://aider.chat/docs/leaderboards/), [BFCL](https://gorilla.cs.berkeley.edu/leaderboard.html), [LiveCodeBench](https://livecodebench.github.io/).

## 권장 OpenCode role mapping

- `plan` / orchestrator: `devstral:24b`로 시작하고, 대안은 `mistral-small3.1/3.2:24b`.
- `explore` / read-only repo scan: VRAM 압박을 낮추려면 `llama3.1:8b` 또는 `qwen3:14b`.
- `scout` / docs research: tool calling이 충분하면 `mistral-small3.1/3.2:24b`; 아니면 더 강한 remote model로 routing.
- `build` / file mutation: 우선 `devstral:24b`; 32K context가 충분한 code-focused fallback은 `qwen2.5-coder:14b`.

## 운영 설정

- 14GB-15GB 모델은 Ollama/OpenCode를 **32K context**로 시작한다. `ollama ps`로 full GPU residency를 확인한 뒤에만 **64K** 쪽으로 올린다.
- orchestrator/planner role은 낮은 temperature를 사용한다. 대략 **0.1-0.3** 범위가 적절하다.
- planner에서는 `edit`와 위험한 `bash` permission을 gated 상태로 둔다. mutation은 executor가 path/command rule 아래에서 처리하게 한다.
- 모델이 기술적으로 실행되더라도 CPU spill이나 load/unload churn이 생기면 orchestrator role에는 부적합한 것으로 본다.

## 최종 추천

18GB VRAM 규칙에서는 **`devstral:24b`를 primary OpenCode orchestrator model로 사용**한다. 저렴한 read-only exploration에는 **`llama3.1:8b` 또는 `qwen3:14b`**를 붙이고, long orchestration보다 code repair가 중요한 작업에는 **`qwen2.5-coder:14b`를 code-edit fallback**으로 유지한다.

## 출처

1. OpenCode agent: https://opencode.ai/docs/agents/
2. OpenCode model: https://opencode.ai/docs/models/
3. OpenCode providers / Ollama config: https://opencode.ai/docs/providers/
4. OpenCode permission: https://opencode.ai/docs/permissions/
5. Ollama OpenCode integration: https://docs.ollama.com/integrations/opencode
6. Ollama context length: https://docs.ollama.com/context-length
7. Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
8. Ollama Devstral: https://ollama.com/library/devstral
9. Ollama Mistral Small: https://ollama.com/library/mistral-small
10. Ollama Qwen3: https://ollama.com/library/qwen3
11. Ollama Qwen3-Coder: https://ollama.com/library/qwen3-coder
12. Ollama Qwen2.5-Coder: https://ollama.com/library/qwen2.5-coder
13. Ollama DeepSeek-Coder-V2: https://ollama.com/library/deepseek-coder-v2
14. Ollama Llama 3.1: https://ollama.com/library/llama3.1
15. Ollama Gemma 3: https://ollama.com/library/gemma3
16. Aider leaderboards: https://aider.chat/docs/leaderboards/
17. BFCL: https://gorilla.cs.berkeley.edu/leaderboard.html
18. LiveCodeBench: https://livecodebench.github.io/
