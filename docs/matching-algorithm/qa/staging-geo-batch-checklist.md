# Staging checklist — provider geo → beacon → batch discovery path

End-to-end validation on **staging** that provider location flows through device beacons into matching discovery and batch eligibility. Complements the batch → MMD → feed path in [`staging-full-batch-path-checklist.md`](./staging-full-batch-path-checklist.md) (task 58).

**Requirements:** Req 1 (beacon location), Req 6 (MMD after batch), Req 12 (client geo / platform behavior).

**Acceptance criteria:** 12.5, 12.20–12.22, 6.1.

---

## Prerequisites

- Staging Supabase with matching M4+ migrations (`user_device_beacons` location columns, `provider_latest_locations`, beacon refresh trigger).
- Cron `matching_process_service_request_dispatches` active (`*/2 * * * *`).
- **Test provider** — role `provider`, `operational_status = active`, offered services + service area overlapping a known client SR location.
- **Test client** — can create an OPEN service request near the provider’s current location.
- Record IDs before starting: `provider_id`, `device_id`, `service_request_id`, `dispatch_id`.

**Timing:** allow up to **2 minutes** per cron tick when waiting for batch open (see full-path checklist).

---

## Platform matrix (QA must read)

| Platform | Location source | Background sync | QA expectation |
|----------|-----------------|-----------------|----------------|
| **Android (Capacitor)** | `@capgo/background-geolocation` | Yes — persistent notification while tracking | Provider sees Orbit notification; location updates after app backgrounded |
| **Web / PWA** | Browser `watchPosition` | **Foreground only** — updates stop when tab/app is backgrounded or closed | Document to QA: web providers must keep app open for beacon freshness; not a staging bug |
| **iOS** | Same Capacitor plugin (when shipped) | Background with permission | Follow Android steps when iOS build is available |

**Web/PWA limitation (Req 12.20–12.22):** matching discovery reads `provider_latest_locations`, refreshed from `user_device_beacons` with `location_permission_granted = true` and `location_recorded_at` within `matching.beacon_location_max_age_hours` (default 24h). On web, if the provider closes the tab, location stops updating — they may fall out of discovery until the next foreground session.

---

## 1. Provider grants location permission

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1.1 | Log in as test provider on target platform | Session active; role `provider` |
| 1.2 | Accept operational location prompt (first launch or settings) | App shows success / tracking started; no permission-denied loop |
| 1.3 | **Android only:** confirm background notification | Notification title **Prestway Orbit**; body mentions updating location for nearby opportunities |
| 1.4 | Move device ~50m+ (or simulate location in emulator) | Client logs / network show location sync attempt (optional: enable verbose logging) |

**Android background check:** after sending app to background, wait ≥1 min, return to app — `user_device_beacons.location_recorded_at` should advance.

**Web check:** with tab focused, wait for watch callback — beacon row updates. Background tab for 5+ min — **no requirement** for further updates (document as expected).

---

## 2. `user_device_beacons` row updated

| Step | Action | Pass criteria |
|------|--------|---------------|
| 2.1 | Query beacon for provider + device | Row exists for `(profile_id, device_id)` |
| 2.2 | Location fields populated | `location` not null; `location_recorded_at` recent (within freshness window) |
| 2.3 | Permission flag | `location_permission_granted = true` |
| 2.4 | Accuracy (optional) | `location_accuracy_meters` plausible for platform |

```sql
-- Replace :provider_id and :device_id
select
  profile_id,
  device_id,
  location_permission_granted,
  location_recorded_at,
  location_accuracy_meters,
  extensions.st_y(location::extensions.geometry) as lat,
  extensions.st_x(location::extensions.geometry) as lng,
  updated_at
from public.user_device_beacons
where profile_id = :provider_id::uuid
  and device_id = :device_id
order by location_recorded_at desc nulls last
limit 1;
```

---

## 3. `provider_latest_locations` trigger fires

The `trg_user_device_beacon_refresh_provider_location` trigger calls `matching_refresh_provider_latest_location` on beacon INSERT/UPDATE **in the same transaction**.

| Step | Action | Pass criteria |
|------|--------|---------------|
| 3.1 | After beacon upsert | Row in `provider_latest_locations` for `provider_id` |
| 3.2 | Freshness | `location_recorded_at` matches newest permitted beacon |
| 3.3 | H3 index | `h3_index` not null when H3 extension available |
| 3.4 | Device linkage | `device_id` matches beacon source |
| 3.5 | Stale beacon cleanup | Revoke permission / clear location → aggregate row deleted or not refreshed |

```sql
select
  provider_id,
  device_id,
  h3_index,
  location_recorded_at,
  location_accuracy_meters,
  updated_at
from public.provider_latest_locations
where provider_id = :provider_id::uuid;
```

**Negative path:** set `location_permission_granted = false` on beacon (or wait past max age) → `provider_latest_locations` row removed on next refresh.

---

## 4. OPEN service request → discovery eligibility

| Step | Action | Pass criteria |
|------|--------|---------------|
| 4.1 | Client creates OPEN SR in same service + neighborhood as provider | `service_requests.status = 'OPEN'`; `location` set |
| 4.2 | Provider within discovery radius | `matching_discover_candidates(sr_id)` includes test `provider_id` (service_role SQL) |
| 4.3 | Dispatch bootstrapped | Row in `service_request_dispatches`; `next_batch_at` due |

```sql
-- Replace :sr_id — run as service_role / postgres on staging
select provider_id
from public.matching_discover_candidates(:sr_id::uuid, 200)
where provider_id = :provider_id::uuid;
```

If provider missing: verify offered service, operational status, H3 ring / distance, and beacon freshness (`matching.beacon_location_max_age_hours`).

**Perf spot-check (optional):** [`supabase/scripts/matching-discovery-explain-beacon-path.sql`](../../../supabase/scripts/matching-discovery-explain-beacon-path.sql).

---

## 5. Cron opens batch → visibility + MMD

Continue with **§2–6** of [`staging-full-batch-path-checklist.md`](./staging-full-batch-path-checklist.md):

| Step | Pass criteria |
|------|---------------|
| Cron batch open | `batch_number` incremented; no stuck lease |
| Batch membership | Provider in `service_request_dispatch_batch_providers` |
| Feed visibility | `service_request_provider_visibility` with `source = 'batch'` |
| Provider app feed | SR visible under **Trabalhos** |
| MMD ingest | `matching.new_opportunity` push + email rows |

Use [`supabase/scripts/matching-staging-batch-path-verify.sql`](../../../supabase/scripts/matching-staging-batch-path-verify.sql) with recorded UUIDs.

---

## 6. End-to-end trace (geo-specific signals)

| Signal | What to verify |
|--------|----------------|
| Client `provider_location_tracking_started` log | Fires once per provider session |
| Client `device_beacon_synced` with `has_location: true` | After permission + sample |
| `user_device_beacons.updated_at` | Advances after movement / foreground watch |
| `provider_latest_locations.updated_at` | Within seconds of beacon upsert |
| `matching_discover_candidates` | Includes provider before cron |
| `service_request_dispatch_events` | `batch_opened` after cron |
| `message_dispatcher.message_dispatches` | Two rows per batch provider |

---

## 7. Sign-off

- [ ] Android: background notification + beacon refresh while backgrounded — **pass / N/A**
- [ ] Web/PWA: foreground-only limitation documented to QA — **pass**
- [ ] Beacon row with fresh location — **pass**
- [ ] `provider_latest_locations` matches beacon — **pass**
- [ ] Discovery includes provider for OPEN SR — **pass**
- [ ] Batch → visibility → feed → MMD (full-path checklist) — **pass**

**Tester / date / platform / provider id / device id / SR id / notes:**

---

## Related docs

- Full batch → MMD → feed: [`staging-full-batch-path-checklist.md`](./staging-full-batch-path-checklist.md)
- MMD template details: [`staging-mmd-new-opportunity-checklist.md`](./staging-mmd-new-opportunity-checklist.md)
- Ops triage: [`../operations.md`](../operations.md)
