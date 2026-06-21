# 검증: 점수 계산

rubric column을 합산하고 candidate model을 정렬하기 위해 로컬 Node.js script를 실행했다.

점수 기준:
- Agentic coding 및 orchestration 근거: 25
- OpenCode/Ollama 기준 context 운용 가능성: 20
- Tool/function/structured-output 적합도: 15
- 18GB 미만 VRAM headroom: 15
- Instruction following 및 planning 안정성: 15
- License/ecosystem 성숙도: 10

출력:

| 모델 | Agentic | Context | Tool | VRAM | Planning | License | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| devstral:24b | 25 | 18 | 13 | 10 | 13 | 10 | 89 |
| mistral-small3.1/3.2:24b | 20 | 18 | 15 | 9 | 14 | 10 | 86 |
| qwen3:14b | 19 | 11 | 14 | 13 | 13 | 10 | 80 |
| llama3.1:8b | 13 | 18 | 13 | 15 | 12 | 8 | 79 |
| deepseek-v2:16b | 17 | 20 | 10 | 13 | 11 | 7 | 78 |
| qwen2.5-coder:14b | 23 | 9 | 12 | 13 | 12 | 9 | 78 |
| magistral:24b | 17 | 11 | 13 | 10 | 15 | 10 | 76 |
| codestral:22b | 18 | 8 | 8 | 11 | 10 | 7 | 62 |
| gemma3:27b | 12 | 18 | 9 | 4 | 12 | 6 | 61 |
| phi4:14b | 12 | 4 | 7 | 13 | 14 | 7 | 57 |
| starcoder2:15b | 14 | 4 | 5 | 13 | 9 | 8 | 53 |
| granite-code:20b | 13 | 2 | 5 | 9 | 8 | 9 | 46 |

판정: 계산이 확인되었다.
