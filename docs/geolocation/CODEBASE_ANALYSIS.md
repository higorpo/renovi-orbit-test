# Phase 1: Codebase analysis – Geolocation for Service Requests

## 1. Service request / budget creation

| Item | Finding |
|------|--------|
| **Screen** | `RequestQuote` at route `pedir-orcamento` (`src/router.tsx`) |
| **Main component** | `src/features/request-quote/components/RequestQuote/RequestQuote.tsx` |
| **Steps** | 5 steps (guest) or 4 (logged in): Step1 Service, Step2 Form, Step3 Description/Photos, **Step4 Address**, Step5 Identity (guest only) |
| **Address step** | `AddressSelectionStep` from `src/features/addresses/components/AddressSelectionStep/AddressSelectionStep.tsx` – "Endereço do serviço" |
| **State** | `useRequestQuoteState`: `step4Data: AddressSelection` (existing addressId or new formData) |
| **Submit** | `useRequestQuoteSubmit` → `createRequestQuoteOrder` (Edge Function) with `step4Data` |

No edit screen for service requests; create-only flow.

---

## 2. Database schema

### service_requests (current)

- **Migration**: `supabase/migrations/20260226100300_create_service_requests.sql` (create), `20260227106000_remove_service_requests_city_neighborhood.sql` (removed city/neighborhood).
- **Current columns**: id, client_id, service_id, address_id, title, description, photos, form_data, form_schema, form_version, status, urgency, scope_complexity, suggested_questions, tags, missing_info_warnings, created_at, updated_at.
- **No**: street, number, neighborhood, city, state, postal_code, country, address_complement, latitude, longitude, geohash, location (PostGIS).

### client_addresses

- **Migration**: `20260226100200_create_client_addresses.sql`.
- **Columns**: id, client_id, label, street, number, complement, neighborhood, zip_code, state_id, city_id, is_default, is_active, created_at, updated_at.
- **No** lat/lng or PostGIS; uses platform_states, platform_cities, platform_neighborhoods (UUIDs).

### PostGIS

- Not enabled in any migration; `config.toml` has `extra_search_path = ["public", "extensions"]` but no `CREATE EXTENSION postgis`.

---

## 3. API layer

| Layer | Path | Role |
|------|------|------|
| **Client API (order)** | `src/features/request-quote/api/createRequestQuoteOrder.api.ts` | Builds FormData (userId, email, address, serviceId, description, formData, formSchema, formVersion, structuredData, photos), POST to Edge Function |
| **Edge Function** | `supabase/functions/create-request-quote-order/` | parseFormData → validateRequestUser → createAddress (if new) → uploadPhotos → **createServiceRequest** |
| **createServiceRequest** | `create-request-quote-order/createServiceRequest.ts` | Inserts row: client_id, service_id, address_id, title, description, photos, form_data, form_schema, form_version, status, urgency, scope_complexity, suggested_questions, tags, missing_info_warnings. **No location fields.** |

Address payload: `AddressPayload` = existing (addressId) or new (formData, label, is_default). Parsed in `parseFormData.ts`; new address passed to `createAddress.ts` which maps formData to `client_addresses` row.

---

## 4. Form components and patterns

- **UI**: `src/components/ui/` (Button, Input, Label, Select, etc.).
- **Address form**: `AddressSelectionStep` uses `useAddressSelection`; fields from `addressFormSchema` (Zod): address_zip, address_street, address_number, address_complement, address_neighborhood_id, address_neighborhood, address_state_id, address_state, address_city_id, address_city.
- **CEP**: ViaCEP in `src/lib/cep.ts`; `resolveFormDataFromCep` in addresses feature; CEP blur triggers fetch and fill.
- **Wizard**: State in hooks; steps as array of components; no generic "map" or "geocoding" yet.

---

## 5. Test structure

- **Unit**: Vitest; `__tests__/` inside features (e.g. `request-quote/hooks/__tests__/`, `utils/__tests__/`, `components/RequestQuote/__tests__/`). Mocks for addresses, dynamic-form.
- **E2E**: Playwright in `e2e/`; `request-quote.spec.ts` uses **real** Supabase (no mocks); needs VITE_SUPABASE_URL and Edge Function deployed.

---

## 6. Architectural conventions

- **Features**: `api/`, `hooks/`, `components/`, `types/`, `utils/`, barrel `index.ts`.
- **Supabase**: Singleton `@/lib/supabase/client`; types in `src/lib/supabase/database.types.ts` (generate with `yarn generate-supabase-types`).
- **No** existing MapProvider/GeocodingService adapters; we will add them under a new feature or under `request-quote`/shared lib.

---

## Decisions for implementation

1. **Where to store geolocation**: On **service_requests** (denormalized snapshot for matching and display). Keep **address_id** for backward compatibility and link to client_addresses when user picks existing or creates new.
2. **Normalized address on service_requests**: Add street, number, neighborhood, city, state, postal_code, country, address_complement so that geographic queries and display do not always require a join to client_addresses (and to support Nominatim-shaped data).
3. **Backward compatibility**: All new columns nullable; existing rows unchanged.
4. **Map integration**: Extend Step 4 (AddressSelectionStep) with an optional map section and sync with form fields via geocoding/reverse geocoding; new abstractions (MapProvider, GeocodingService, Nominatim adapter) in a dedicated feature or `src/features/request-quote` + shared `src/lib/` or `src/features/geolocation`.
5. **Draft version**: Bump `REQUEST_QUOTE_DRAFT_VERSION` in `requestQuoteDraft.persistence.ts` when step4/location shape changes.
