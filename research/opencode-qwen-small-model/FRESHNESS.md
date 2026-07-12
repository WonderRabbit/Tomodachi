# 리서치 신선도 및 승격 통제

이 문서는 2026-06-21 결론을 다시 쓰지 않고, 재검증 시점과 승격 조건만 관리한다. 아래 관측은 로컬 파일 상태를 확인한 것이며 외부 model/provider 사실을 새로 검증했다는 뜻이 아니다.

```json
{
  "schemaVersion": 1,
  "packId": "opencode-qwen-small-model",
  "observedAt": "2026-07-12T13:58:23+09:00",
  "sourceOrProbe": {
    "kind": "local-file",
    "target": "research/opencode-qwen-small-model/README.md",
    "outputSha256": "97fbe05b445cbce373461fdcbd3ee4614425c014d0aaa502c9b13178f0a61789"
  },
  "freshnessWindowDays": 90,
  "expiresAt": "2026-10-10T13:58:23+09:00",
  "classification": {
    "volatile": ["Qwen model availability", "serving parser requirements", "context limits", "benchmark claims"],
    "stable": ["packet lifecycle principle", "permission-boundary principle", "recorded 2026-06-21 conclusion"]
  },
  "promotionStatus": "not-promoted",
  "promotionChecklist": [
    { "item": "공식 Qwen 모델 카드와 OpenCode 계약을 새 관측 시점으로 재확인한다.", "complete": false },
    { "item": "대상 runtime에서 context·OOM·tool-calling 동작을 재현한다.", "complete": false },
    { "item": "packet lifecycle 실패·resume fixture를 실행한다.", "complete": false },
    { "item": "권한·보안·fallback 영향을 검토한다.", "complete": false },
    { "item": "제품 변경 범위와 rollback 방안을 별도 계획으로 승인받는다.", "complete": false }
  ],
  "staleBehavior": "만료되면 현재 모델 선택 근거로 인용하거나 provider/model 승격에 사용하지 않고 historical-only로 표시한다.",
  "refreshMethods": {
    "best": "공식 문서와 대상 Qwen runtime의 packet/tool replay를 같은 날 재검증하고 결과 digest를 기록한다.",
    "secondBest": "공식 문서와 OpenCode 계약만 재확인하고 runtime 미검증을 명시한다."
  }
}
```

체크리스트가 모두 `false`인 상태는 미승격을 뜻한다. 완료 표시만으로 승격되지 않으며 별도 구현 계획과 승인이 필요하다.
