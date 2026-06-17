# ADR 0002: Dual location model (batch vs feed)

**Status:** Accepted (2026-06-17)

## Context

Batch eligibility requires background provider position (`user_device_beacons`) with freshness rules. The provider jobs feed also needs distance/sorting when the provider opens the screen, but providers may deny background location or use web/PWA with foreground-only GPS.

Using a single location source for both concerns creates either poor batch accuracy (client-passed coordinates) or poor feed UX (stale beacon only).

## Decision

Use **two location sources** with distinct roles:

| Context | Source | Purpose |
|---------|--------|---------|
| Batch eligibility, ranking proximity, notifications | `user_device_beacons` → aggregated `provider_latest_locations` | Operational matching within **20 km** (hardcoded in discovery SQL, #126) or neighborhood fallback without beacon |
| Feed access (`list_provider_opportunities`) | Optional lat/lng from Capacitor/browser at request time | Sort modes and `distance_km` display only |

Rules:

- Feed GPS **does not** filter by 20 km; **visibility** is the gate (decision #48).
- Without feed GPS: sort by `newest` or `least_competitive`; show permission UX hint.
- Without valid beacon (< 24 h freshness or no permission): batch eligibility uses **exact neighborhood** match from `provider_service_area_neighborhoods` and **deprioritized** ranking (proximity = 0, −20% penalty).

## Consequences

- **Positive:** Clear separation of operational vs navigation location.
- **Positive:** Feed remains useful without background GPS permission.
- **Negative:** Two code paths for distance; must not mix them in ranking at batch time.
- **Implementation:** `provider_latest_locations` updated by trigger on beacon upsert; H3 res 7 pre-filter.

See also: `docs/matching-algorithm/CONTEXT.md` decisions #2–#4, #9–#10, #16–#18, #48, #113, #126.
