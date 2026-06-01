# CNS AC coverage sign-off (Wave F gate)

Use this checklist on the release PR that enables Wave F production cutover.

## Automated gate

```bash
yarn audit:cns-ac-coverage
```

CI runs the same check via `yarn ci` (step **CNS AC Coverage**).

## Sign-off

| Field | Value |
|-------|--------|
| Release / PR | |
| Date | |
| Auditor | |

- [ ] `yarn audit:cns-ac-coverage` passes (274 `R*-AC*` rows in Appendix A + `OAC-01`…`OAC-18` in task metadata)
- [ ] `yarn ci` green (Vitest, Deno, pgTAP, types)
- [ ] pgTAP `supabase/tests/chats/` executed on target environment
- [ ] Optional: `CI_E2E_CHATS=1 yarn ci` for `e2e/tests/chats.spec.ts`
- [ ] Rollout runbook reviewed: `docs/chats/wave-bf-rollout-runbook.md`
- [ ] Business docs synced: `docs/business/modulos/chats/`

## Notes

| AC / topic | Reviewer note |
|------------|---------------|
| R32-AC05 | Architecture review — RPC-only FSM, no Edge FSM, single SOT |
| R32-AC06 | pgTAP `concurrency_test.sql` — `FOR UPDATE` on SR |
| OAC-05 | Tasks 8, 24, 51, 54, 71 |
| OAC-10 | Tasks 17, 72–79 |

## Blocking defects

_List any AC gaps filed as defects before merge._
