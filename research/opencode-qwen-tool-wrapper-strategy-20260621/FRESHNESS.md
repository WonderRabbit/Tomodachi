# 리서치 신선도 및 승격 통제

이 문서는 2026-06-21 결론을 다시 쓰지 않고, 재검증 시점과 승격 조건만 관리한다. 아래 관측은 로컬 파일 상태를 확인한 것이며 tool 도입이나 외부 문서 갱신을 의미하지 않는다.

```json
{
  "schemaVersion": 1,
  "packId": "opencode-qwen-tool-wrapper-strategy-20260621",
  "observedAt": "2026-07-12T13:58:23+09:00",
  "sourceOrProbe": {
    "kind": "local-file",
    "target": "research/opencode-qwen-tool-wrapper-strategy-20260621/README.md",
    "outputSha256": "582408fd0c83b4150d1b8e02d7122e424580e70510c7cf1f1baf20d284e20fb8"
  },
  "freshnessWindowDays": 90,
  "expiresAt": "2026-10-10T13:58:23+09:00",
  "classification": {
    "volatile": ["CLI installation state", "CLI versions", "OpenCode tool API", "Qwen parser support"],
    "stable": ["typed wrapper principle", "preview-before-apply principle", "recorded 2026-06-21 conclusion"]
  },
  "promotionStatus": "not-promoted",
  "promotionChecklist": [
    { "item": "공식 CLI와 OpenCode tool 문서를 새 관측 시점으로 재확인한다.", "complete": false },
    { "item": "각 wrapper의 argv·출력 크기·path 경계를 fixture로 검증한다.", "complete": false },
    { "item": "실제 Qwen runtime에서 helper와 broad shell을 비교 재생한다.", "complete": false },
    { "item": "권한·설치·공급망·rollback 영향을 검토한다.", "complete": false },
    { "item": "tool 도입을 별도 구현 계획으로 승인받는다.", "complete": false }
  ],
  "staleBehavior": "만료되면 현재 tool inventory나 도입 근거로 인용하지 않고 historical-only로 표시한다.",
  "refreshMethods": {
    "best": "공식 문서, 로컬 설치 버전, 결정적 wrapper fixture를 같은 날 재검증하고 출력 digest를 기록한다.",
    "secondBest": "공식 문서와 로컬 버전만 재확인하고 end-to-end Qwen replay 미검증을 명시한다."
  }
}
```

체크리스트가 모두 `false`인 상태는 미승격을 뜻한다. 완료 표시만으로 승격되지 않으며 별도 구현 계획과 승인이 필요하다.
