# 1차 조사 요약: VRAM 및 Context 현실

핵심 findings:
- Ollama의 listed model size는 전체 VRAM 요구량이 아니다. context/KV cache와 runtime overhead가 추가 memory를 사용한다.
- Ollama 문서는 24 GiB VRAM 미만에서 default가 4k context라고 설명한다. 반면 coding agent는 가능하면 최소 64k tokens를 사용하는 편이 좋다.
- 18GB 미만에서 practical fit은 단순히 "model file이 18GB 미만"이라는 뜻이 아니라 "model + context가 대부분 또는 전부 GPU resident로 남는다"는 뜻이다.
- 안전한 class: 7B/8B at Q4/Q5. 대체로 안전한 class: moderated context를 둔 12B/14B at Q4/Q5. Borderline: 20B at Q4. Out-of-budget: Ollama default 19GB+ listing의 30B MoE.

출처:
- https://docs.ollama.com/context-length
- https://docs.ollama.com/faq
- https://docs.ollama.com/modelfile
- https://github.com/ggml-org/llama.cpp

## EXPAND

- LEAD: 각 model family의 exact KV-cache per-token memory -- WHY: qualitative threshold를 4k/8k/32k/64k token-budget number로 바꿀 수 있음 -- ANGLE: `n_layer`, `n_head_kv`, `head_dim`에 대한 GGUF metadata 확인.
- LEAD: default page size를 넘는 official Ollama per-model quantization variants -- WHY: library page는 install size를 보여주지만 모든 Q4/Q5/Q8 tag를 보여주지는 않음 -- ANGLE: model tag page 확인.
- LEAD: Flash Attention과 함께 쓰는 Ollama `OLLAMA_KV_CACHE_TYPE` support의 실제 효과 -- WHY: long-context cutoff를 실질적으로 바꿀 수 있음 -- ANGLE: docs/issues/community benchmarks 확인.
- LEAD: 16/18GB card에서 30B MoE community benchmark -- WHY: active parameters가 loaded-memory requirement를 오해하게 만들 수 있음 -- ANGLE: Qwen3-30B-A3B 및 Mixtral reports 검색.
