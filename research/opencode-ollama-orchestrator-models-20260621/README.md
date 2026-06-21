# OpenCode Ollama 오케스트레이터 모델 리서치

리서치 일자: 2026-06-21

## 목적

이 문서 세트는 OpenCode의 task-management 및 orchestrator agent에 붙여 사용할 수 있는 Ollama 실행 모델을 비교한다. 비교 대상은 VRAM 18GB 미만 예산에서 현실적으로 사용할 수 있는 모델이다.

비교에서는 다음 항목을 우선했다.

- agentic coding 및 repository repair 근거
- OpenCode tool/subagent 오케스트레이션 적합도
- Ollama 기준 context 운용 가능성
- 18GB 미만 VRAM headroom
- instruction following 및 planning 안정성
- license 및 ecosystem 성숙도

## 먼저 읽을 문서

- `SYNTHESIS.md`: 최종 추천, 점수표, 출처, caveat.
- `verify-scoring.md`: 점수 합산을 검증한 로컬 계산 기록.
- `expansion-log.md`: 리서치 wave, lead 종료, convergence 기록.

## 보조 digest

- `wave-1-librarian-model-catalog.md`: Ollama 모델 catalog 조사 결과.
- `wave-1-librarian-benchmarks.md`: benchmark 및 coding-agent 근거.
- `wave-1-librarian-vram-context.md`: VRAM, context, quantization 제약.

## 현재 추천

18GB VRAM 규칙에서는 `devstral:24b`를 기본 OpenCode orchestrator 모델로 사용한다.

일반 agent/function-calling 대안으로는 `mistral-small3.1:24b` 또는 `mistral-small3.2:24b`를 사용한다.

저렴한 read-only exploration role에는 `llama3.1:8b` 또는 `qwen3:14b`를 사용하고, 32K context가 충분한 code-edit fallback으로는 `qwen2.5-coder:14b`를 유지한다.

## 검증 범위

이 리서치는 최신 공식 문서, Ollama 모델 페이지, benchmark reference, 로컬 점수 합산 스크립트를 사용했다. 로컬 모델 추론 benchmark는 실행하지 않았다.
