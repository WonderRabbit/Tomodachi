# Wave 1 Digest: Coding-Agent Benchmark 근거

핵심 findings:
- SWE-bench는 repository-level repair와 multi-file issue resolution에 가장 가까운 benchmark다.
- Aider polyglot은 coding harness 안에서 test를 통과하는 file edit를 측정하므로 editing-loop proxy로 유용하다.
- BFCL은 tool-calling/orchestration benchmark signal로 가장 강하다. V3/V4는 multi-turn과 실질적인 cost/latency 차원을 추가한다.
- LiveCodeBench는 contamination-aware coding benchmark로 유용하며, deployment decision에서는 HumanEval/MBPP보다 우선해야 한다.
- HumanEval과 MBPP는 대체로 short-function synthesis를 측정하므로 OpenCode orchestrator에 대한 standalone evidence로는 약하다.

출처:
- https://arxiv.org/abs/2310.06770
- https://aider.chat/docs/leaderboards/
- https://gorilla.cs.berkeley.edu/leaderboard.html
- https://livecodebench.github.io/
- https://arxiv.org/abs/2403.07974
- https://arxiv.org/abs/2108.07732
- https://arxiv.org/abs/2409.12186

## EXPAND

- LEAD: `SWE-bench Pro` public split -- WHY: current coding-agent capability와 contamination concern 관점에서 Verified보다 더 관련 있을 수 있음 -- ANGLE: official paper / leaderboard를 검색하고 Lite/Verified와 비교.
- LEAD: `BFCL` V4 model rankings for small open-weight models -- WHY: tool-calling / orchestration behavior를 직접 측정함 -- ANGLE: open 7B-14B model의 current leaderboard row 확인.
- LEAD: `Qwen2.5-Coder` 및 `DeepSeek-Coder` technical report benchmark table -- WHY: SWE-bench / HumanEval / MBPP / repair-style task의 exact score 추출 필요 -- ANGLE: PDF/paper table을 열어 relevant row 추출.
- LEAD: `Aider` leaderboard data files -- WHY: reproducible benchmark run과 model-specific pass rate를 포함함 -- ANGLE: small local model에 대한 repo leaderboard YAML 확인.
- LEAD: `LiveCodeBench` leaderboard by model size -- WHY: open 7B-14B model이 contamination-resistant code task에서 경쟁력 있는지 확인 필요 -- ANGLE: leaderboard row를 확인하고 open-weight model만 비교.
