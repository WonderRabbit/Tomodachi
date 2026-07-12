# 리서치 신선도 및 승격 통제

이 문서는 2026-06-21 결론을 다시 쓰지 않고, 재검증 시점과 승격 조건만 관리한다. 아래 관측은 로컬 파일 상태를 확인한 것이며 tool 도입이나 외부 문서 갱신을 의미하지 않는다.

```json
{
  "schemaVersion": 1,
  "packId": "opencode-small-model-helper-cli",
  "observedAt": "2026-07-12T13:58:23+09:00",
  "sourceOrProbe": {
    "kind": "local-file",
    "target": "research/opencode-small-model-helper-cli/README.md",
    "outputSha256": "5165258133f40eda26f24d2d41da16b4e8c16ffac88344e8d6acd6df86ffeaa8"
  },
  "freshnessWindowDays": 90,
  "expiresAt": "2026-10-10T13:58:23+09:00",
  "classification": {
    "volatile": ["CLI installation state", "CLI versions", "OpenCode permission API", "model tool-use behavior"],
    "stable": ["typed helper boundary principle", "bounded-output principle", "recorded 2026-06-21 conclusion"]
  },
  "promotionStatus": "not-promoted",
  "promotionChecklist": [
    { "item": "공식 CLI와 OpenCode permission 문서를 새 관측 시점으로 재확인한다.", "complete": false },
    { "item": "helper schema·path·출력 제한을 악성 fixture로 검증한다.", "complete": false },
    { "item": "실제 small-model runtime에서 helper 효과를 비교 재생한다.", "complete": false },
    { "item": "설치·공급망·권한·rollback 영향을 검토한다.", "complete": false },
    { "item": "tool 도입을 별도 구현 계획으로 승인받는다.", "complete": false }
  ],
  "staleBehavior": "만료되면 현재 CLI inventory나 도입 근거로 인용하지 않고 historical-only로 표시한다.",
  "refreshMethods": {
    "best": "공식 문서, 로컬 설치 버전, 결정적 helper fixture를 같은 날 재검증하고 출력 digest를 기록한다.",
    "secondBest": "공식 문서와 로컬 버전만 재확인하고 small-model end-to-end replay 미검증을 명시한다."
  }
}
```

체크리스트가 모두 `false`인 상태는 미승격을 뜻한다. 완료 표시만으로 승격되지 않으며 별도 구현 계획과 승인이 필요하다.
