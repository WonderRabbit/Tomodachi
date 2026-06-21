# Wave 1 Digest: Ollama Model Catalog

핵심 findings:
- 강한 18GB 미만 후보로 `devstral:24b`, `mistral-small3.1:24b` / `mistral-small3.2:24b`, `codestral:22b`, `qwen3:14b`, `gemma3:27b`, `deepseek-v2:16b`, `phi4:14b`, `starcoder2:15b`, `llama3.1:8b`가 확인되었다.
- `qwen3-coder:30b` / `latest`는 관련성이 높지만 Ollama listed size가 19GB이므로 엄격한 18GB 미만 set에서는 제외된다.
- DeepSeek-Coder-V2-Lite는 별도 Ollama library page로 확인되지 않았다. 발견된 DeepSeek 계열 long-context option은 `deepseek-v2:16b`다.

출처:
- https://ollama.com/library/qwen3
- https://ollama.com/library/qwen3-coder
- https://ollama.com/library/devstral
- https://ollama.com/library/gemma3
- https://ollama.com/library/phi4
- https://ollama.com/library/starcoder2
- https://ollama.com/library/codestral

## EXPAND

- LEAD: `DeepSeek-Coder-V2-Lite` Ollama availability -- WHY: 사용자가 DeepSeek coder-lite option을 기대할 수 있지만 Ollama에서는 `deepseek-coder`와 `deepseek-v2`만 surfaced -- ANGLE: Ollama/library 및 model cards 검색.
- LEAD: `Qwen3-Coder-Next` local packaging status -- WHY: budget 안에서 가능하다면 Qwen3 general model보다 agentic-coding fit이 더 좋을 수 있음 -- ANGLE: Ollama/library 및 Qwen/HF 검색.
- LEAD: `Phi-4` official Microsoft card details -- WHY: Ollama에는 model이 있지만 license/deployment caveat는 primary source 확인 필요 -- ANGLE: Microsoft/Hugging Face card 검색.
