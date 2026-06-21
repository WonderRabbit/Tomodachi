# Expansion Log

## Phase 0

핵심 질문: VRAM 18GB 미만에서 실행 가능한 Ollama 모델 중 OpenCode task-management 및 orchestration agent에 가장 잘 맞는 모델은 무엇인가?

조사 축:
- OpenCode agent 요구사항: agent/subagent config, permissions, model routing, context 요구사항.
- Ollama 모델 카탈로그: 현재 tag, 표시된 model size, context window, OpenCode 실행 통합.
- Agent/coding 벤치마크 신호: SWE-bench, coding-agent claims, tool/function-calling 근거.
- VRAM과 context 현실: listed model size가 안전한 64K+ VRAM 운용과 같지 않은 이유.

점수 기준:
- Agentic coding 및 orchestration 근거: 25
- OpenCode/Ollama 기준 context 운용 가능성: 20
- 도구/함수/구조화 출력 적합도: 15
- 18GB 미만 VRAM headroom: 15
- 지시 이행 및 계획 안정성: 15
- License/ecosystem 성숙도: 10

## Wave 1

실행한 조사 lane:
- OpenCode orchestrator 요구사항 조사.
- Ollama 모델 카탈로그 조사.
- Coding-agent 벤치마크 조사.
- VRAM/context librarian.

반환된 결과:
- Ollama 모델 카탈로그 조사.

확보한 marker:
- LEAD: DeepSeek-Coder-V2-Lite Ollama availability -- WHY: 사용자가 DeepSeek coder-lite 계열을 기대할 수 있지만 Ollama에서는 `deepseek-coder`와 `deepseek-v2`만 확인됨 -- ANGLE: Ollama/library 및 model card 검색.
- LEAD: Qwen3-Coder-Next local packaging status -- WHY: 예산 안에서 사용 가능하다면 Qwen3 general model보다 agentic-coding fit이 좋을 수 있음 -- ANGLE: Ollama/library 및 Qwen/HF 검색.
- LEAD: Phi-4 official Microsoft card details -- WHY: Ollama에는 모델이 있지만 license/deployment caveat는 primary source 확인 필요 -- ANGLE: Microsoft/Hugging Face card 검색.

## Wave 2

조사한 항목:
- DeepSeek-Coder-V2-Lite Ollama 제공 여부.
- Qwen3-Coder-Next Ollama 제공 여부.
- OpenCode Ollama provider 및 model/tool-calling 문서.
- Ollama context-length 및 OpenAI 호환성 문서.

종료한 항목:
- DeepSeek-Coder-V2-Lite first-party Ollama library candidate: direct search pass에서 별도 current Ollama library page를 찾지 못했다. visible Ollama catalog에 머문다면 `deepseek-v2:16b` 또는 `deepseek-coder:6.7b`를 사용한다.
- Qwen3-Coder-Next first-party Ollama library candidate: direct search pass에서 current Ollama library page를 찾지 못했다. `qwen3-coder:30b`는 보이지만 19GB라서 사용자 cutoff에 의해 제외된다.
- OpenCode local-provider setup: current docs는 OpenAI-compatible `baseURL: http://localhost:11434/v1` 기반 Ollama provider config를 확인한다.

새 marker:
- LEAD: 각 후보의 exact current leaderboard rows -- WHY: 일부 leaderboard는 dynamic하고 local model row가 sparse함 -- ANGLE: production default 결정 전 optional future live scrape.

## Wave 3

조사한 항목:
- Dynamic leaderboard row는 main recommendation의 blocker가 아니라고 판단했다. 최상위 후보는 직접적인 model-page claim과 official OpenCode/Ollama constraint를 갖고 있다. exact row 수집은 production rollout 전 follow-up validation step으로 둔다.

수렴 판단:
- under-18GB Ollama shortlist에 대해 미확인 model-eligibility lead는 남지 않았다.
- 남은 lead는 validation-depth 작업이며, 비교 추천의 blocker는 아니다.
