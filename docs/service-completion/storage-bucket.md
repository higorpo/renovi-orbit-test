# Completion-evidence Storage bucket (Task 79)

**Canonical bucket id/name:** `completion-evidence` (same in local, staging, and prod — no env-specific rename).  
**MUST NOT** reuse: `service-requests`, `chat-media`, `provider-kyc-documents`, `provider-portfolio-images`.

Normative: [design §11.4](./design.md) · migration `20260804100000_service_completion_evidence_storage.sql` · KYC-style client upload · SQL janitor `service_completion_janitor_orphan_uploads`.

---

## Path layout

```
{contracted_service_id}/{session_id}/{uuid_filename}
```

- Unique keys — no silent overwrite (no authenticated UPDATE policy).
- Sessions: `completion_evidence_upload_sessions.storage_bucket` MUST be `'completion-evidence'`.

---

## Policies (Task 10)

| Policy | Role | Effect |
|--------|------|--------|
| `storage_objects_completion_evidence_select` | `authenticated` | SELECT when path owned by contracted provider (or platform admin) |
| `storage_objects_completion_evidence_insert` | `authenticated` | INSERT under **open** owned session prefix (provider only) |
| `storage_objects_completion_evidence_service_role` | `service_role` | ALL — SQL orphan janitor deletes |

Helpers: `service_completion_evidence_storage_path_owned`, `service_completion_evidence_storage_upload_allowed`.

---

## Provisioning by environment

### Local

Applied by migration on `yarn db:reset` / migration apply.

```sql
select id, name, public from storage.buckets where id = 'completion-evidence';
-- expect: completion-evidence | false

select polname
from pg_policy
where polrelid = 'storage.objects'::regclass
  and polname like '%completion_evidence%';
-- expect 3 policies
```

Upload path: app API `uploadEvidenceFile` (create session RPC → `storage.upload` → register RPC). No Edge Function for evidence upload.

### Staging / production

1. Deploy migrations through Task 10+ (bucket INSERT is idempotent `on conflict do update`).
2. Confirm in Dashboard → Storage → buckets that `completion-evidence` exists and is **private**.
3. Confirm policies above exist (SQL check as local).
4. Cron: `service_completion_orphan_upload_janitor` (SQL deletes via `DELETE FROM storage.objects`; same pattern as KYC janitor).

If a host ever used a different bucket name, set it only via an explicit migration changing `storage_bucket` defaults — do **not** fork per-env names without updating sessions + policies.

---

## Janitor delete capability

Orphan janitor (`service_completion_janitor_orphan_uploads` + cron wrapper) deletes via **SQL** `DELETE FROM storage.objects` (KYC pattern). Policy `storage_objects_completion_evidence_service_role` MUST allow DELETE for `bucket_id = 'completion-evidence'`.

Smoke (staging):

1. Create open upload session + register object path (or upload via app).
2. Let session expire past `completion_evidence_orphan_ttl_hours` **without** freezing into evidence responses.
3. Run janitor once → Storage object gone (or already missing = success) + registry row removed.
4. Confirm frozen/referenced paths are **never** deleted (`referenced_in_responses` / frozen package guards).

---

## Upload smoke (staging)

1. Provider on `CONFIRMED` CS opens draft checklist.
2. App creates upload session + `storage.upload` into bucket `completion-evidence` under session prefix.
3. Upload succeeds; path matches `{cs}/{session}/{uuid}`.
4. Client cannot list arbitrary keys; provider SELECT works for own prefix.
5. Mark executed freezes paths; subsequent orphan janitor skips those objects.

---

## Cutover gate

Include in [cutover.md](./cutover.md) §3: bucket + policies verified in each environment before traffic that exercises provider evidence uploads.
