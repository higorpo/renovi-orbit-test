# ADR 0003: `list_provider_opportunities` replaces `match_provider_jobs`

**Status:** Accepted (2026-06-17, updated 2026-06-17)

## Context

ADR 0001 removes the open-radius feed. The provider-facing API needs a visibility-gated opportunities list, optional client-side coordinates, sort modes, feed exclusion rules, and separate audit/decline flows. Renaming only the Edge Function while keeping the old RPC would preserve confusing legacy semantics (`p_radius_km`, all `OPEN` rows).

## Decision

### Backend

- **Remove** `public.match_provider_jobs`.
- **Add** `public.list_provider_opportunities` with:
  - **Union:** persisted batch visibility (`revoked_at` NULL, `dismissed_at` NULL) **∪** lazy fallback when `fallback_opened_at IS NOT NULL` and dispatch not `EXPIRED` (#75, #85, #86).
  - **Exclude** per provider: dismissed; in-flight proposal; **ACTIVE** chat; **any prior proposal row** on that SR (#95, #96).
  - “Already notified” for batch discovery = existing batch visibility row (#114) — independent of push/e-mail delivery (#12).
  - Optional nullable `p_lat` / `p_lng` for feed navigation (sort + display only, ADR 0002).
  - Sort modes: `newest`, `least_competitive`, `nearest` (nearest only when coordinates provided, #73).
  - **Cursor-based** pagination (#58); no radius filter on feed query.
- **Add** Edge Function `list-provider-opportunities` (replaces `match-provider-jobs`).
- **Add** `record_provider_opportunity_view(p_service_request_id)` — idempotent audit; **not** called from `get_service` (#92–#94).
- **Add** `dismiss_provider_opportunity(p_service_request_id)` — idempotent; feed-only effect (#100–#102).

### Client wiring

| RPC | Feature | API layer |
|-----|---------|-----------|
| `list_provider_opportunities` | `provider-jobs` | `provider-jobs/api/` → Edge (#120) |
| `dismiss_provider_opportunity` | `provider-jobs` feed card only (#117) | `provider-jobs/api/` (#118) |
| `record_provider_opportunity_view` | `view-services` | `view-services/api/` + hook on `ServiceDetailPage` / `ServiceDetailSheet` mount (#115–#116, #119) |

- **`get_service`** remains read-only with no dispatch side effects (#92).
- Dismiss action **not** offered on detail screen (#117).

### Routes

- **Keep** feature module `provider-jobs` and existing dashboard routes.

## Consequences

- **Positive:** RPC name reflects visibility-gated opportunities, not geographic job matching alone.
- **Positive:** View tracking works for deep links (push, e-mail) via shared detail surfaces (#94).
- **Positive:** Clean break from legacy parameters in dev environment.
- **Negative:** All consumers of `match_provider_jobs` must migrate in the same release.
- **Negative:** Feed hide rules require joins to proposals/chats — query complexity in PG.

See also: `docs/matching-algorithm/CONTEXT.md` decisions #43, #49, #58, #73, #92–#102, #114–#120; ADR 0002.
