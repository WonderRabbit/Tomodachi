# 리서치 신선도 및 승격 통제

이 문서는 2026-06-21 결론을 다시 쓰지 않고, 재검증 시점과 승격 조건만 관리한다. 아래 관측은 로컬 파일 상태를 확인한 것이며 외부 model/provider 사실을 새로 검증했다는 뜻이 아니다.

```json
{
  "schemaVersion": 1,
  "packId": "opencode-ollama-orchestrator-models-20260621",
  "observedAt": "2026-07-12T13:58:23+09:00",
  "sourceOrProbe": {
    "kind": "local-file",
    "target": "research/opencode-ollama-orchestrator-models-20260621/README.md",
    "outputSha256": "0012b730ea4523a31df6f914c094614ec32e1a44c17d4de507dcd0eb82ffd439"
  },
  "freshnessWindowDays": 90,
  "expiresAt": "2026-10-10T13:58:23+09:00",
  "classification": {
    "volatile": ["model availability", "Ollama tags", "benchmark standings", "VRAM/runtime behavior"],
    "stable": ["historical comparison method", "18GB evaluation constraint", "recorded 2026-06-21 conclusion"]
  },
  "promotionStatus": "not-promoted",
  "promotionChecklist": [
    { "item": "공식 model/provider 출처를 새 관측 시점으로 재확인한다.", "complete": false },
    { "item": "로컬 runtime에서 VRAM과 context 한계를 다시 측정한다.", "complete": false },
    { "item": "추천 후보를 동일한 fixture와 scoring 기준으로 비교한다.", "complete": false },
    { "item": "보안·라이선스·운영 비용 영향을 검토한다.", "complete": false },
    { "item": "제품 변경 범위와 rollback 방안을 별도 계획으로 승인받는다.", "complete": false }
  ],
  "staleBehavior": "만료되면 현재 추천 근거로 인용하거나 provider/model 승격에 사용하지 않고 historical-only로 표시한다.",
  "refreshMethods": {
    "best": "공식 모델 문서와 실제 Ollama runtime을 같은 날 재검증하고 결정적 결과 digest를 기록한다.",
    "secondBest": "공식 모델 문서만 재확인하고 로컬 runtime 미검증을 명시한 채 후보 비교를 갱신한다."
  }
}
```

체크리스트가 모두 `false`인 상태는 미승격을 뜻한다. 완료 표시만으로 승격되지 않으며 별도 구현 계획과 승인이 필요하다.
