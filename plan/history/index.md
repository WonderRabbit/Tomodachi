# Tomodachi work-history index

Last verified: 2026-07-12 (Asia/Seoul)

## Evidence precedence

The first available source wins for current-state claims. Lower levels preserve intent or dated proof; they do not override higher levels.

1. `current-tracked-source`
2. `git-chronology`
3. `plan-docs`
4. `classified-historical-evidence`

## Lifecycle ledger

`canonical` identifies the repository-facing plan artifact. `historical-evidence` preserves a dated local record. `superseded` names a different indexed successor. Conflicts are classified rather than rewritten, and every row names its next lifecycle check. A plan header such as `실행 전` records the artifact's authoring-time phase; it is intentionally preserved and does not override the lifecycle below, the completed active `.omo` plan, Boulder, or the Korean implementation result.

| Source | Classification | Lifecycle | Commit | Last verified | Successor | Conflict | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plan/tomodachi-work-history-improvement.md | canonical | completed | working-tree | 2026-07-12 | - | none | retain-completed-plan |
| plan/tomodachi-env-cicd.md | canonical | completed | 0a07266d53b83cd07017ec912c616eecbcc3d693 | 2026-07-12 | - | none | reverify-current-source |
| plan/ui-ux-mvp-flow.md | canonical | active | 49640fc67d3384f04a13878b6a3b6cfc7fb3687d | 2026-07-12 | - | none | reverify-current-source |
| .omo/boulder.json | historical-evidence | completed | working-tree | 2026-07-12 | - | none | retain-completed-control-record |
| .omo/plans/one-command-tomodachi-install-deploy.md | superseded | pending | working-tree | 2026-07-12 | plan/tomodachi-env-cicd.md | all-unchecked-despite-implementation | retain-superseded-plan |
| .omo/plans/tomodachi-env-cicd.md | historical-evidence | completed | working-tree | 2026-07-12 | - | none | reverify-current-source |
| .omo/plans/tomodachi-work-history-improvement.md | historical-evidence | completed | working-tree | 2026-07-12 | - | none | retain-completed-plan |
| .omo/ulw-loop/019ee8d0-1873-7141-aed5-6920ce8ce695 | historical-evidence | completed | working-tree | 2026-07-12 | - | none | retain-completed-run |
| .omo/ulw-loop/019ef9e6-3db3-7e73-ac4e-e803b001bbe4 | historical-evidence | mixed | working-tree | 2026-07-12 | - | g001-review-blocked-g002-complete-no-aggregate | prefer-canonical-completion |
| .omo/ulw-loop/tomodachi-db-init-20260621 | superseded | pending | working-tree | 2026-07-12 | .omo/ulw-loop/tomodachi-db-init-single-20260621 | seven-pending-plan-created-duplicated-by-completed-run | retain-superseded-run |
| .omo/ulw-loop/tomodachi-db-init-single-20260621 | historical-evidence | completed | working-tree | 2026-07-12 | - | none | retain-completed-run |
| .omo/ulw-loop/tomodachi-integration-docs-20260621 | historical-evidence | completed | working-tree | 2026-07-12 | - | none | retain-completed-run |
| .omo/ulw-loop/tomodachi-work-history-implementation-20260712 | historical-evidence | completed | working-tree | 2026-07-12 | - | none | retain-completed-run |

## Reverification

- Canonical source: inspect the tracked file and rerun its relevant test or validator.
- Git chronology: use `git show <commit> -- <path>` and retain the full commit hash.
- Plan/docs: compare claims with current source before implementation.
- Historical evidence: retain the original `.omo` artifact and classify conflicts instead of rewriting it.
