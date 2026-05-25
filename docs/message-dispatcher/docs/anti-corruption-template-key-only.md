# MMD anti-corruption — `template_key` + variables only

Engineering contract for producers integrating with the Multichannel Message Dispatcher. Source of truth: `design.md` §11.5.

## Rule

Producers MUST send:

- `template_key` — registered in `message_dispatcher.message_templates`
- `template_variables` — JSON object validated against `variable_schema` (max **8KB**)

Producers MUST NOT send:

- Raw HTML email bodies
- Raw push title/body strings outside the template registry
- Arbitrary Resend/FCM payloads from client apps

Rendering happens **only** in `message-dispatcher-worker` using DB-backed templates (Mustache for email, schema-validated strings for push).

## Why

| Risk if violated | Mitigation |
|-----------------|------------|
| HTML injection via producer JSON | Templates are operator-controlled; variables are escaped/substituted |
| Channel bypass (SMS, unknown provider) | `message_channel` enum + template FK at ingest |
| Untested copy in production | Template changes go through migration/seed review |

## Correct ingest example

```json
{
  "p_idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
  "p_profile_id": "…",
  "p_channel": "email",
  "p_template_key": "welcome_template",
  "p_template_variables": { "name": "Ana", "coupon": "SAVE10" }
}
```

## Forbidden patterns

```json
{
  "p_template_key": "custom",
  "p_template_variables": {
    "html": "<script>alert(1)</script>",
    "subject": "Phishing subject"
  }
}
```

Unknown `template_key` → RPC error `22023`. Oversized variables → `template_variables exceeds 8192 bytes`.

## Feature integration checklist

- [ ] Orbit features call `message_dispatcher_ingest` via feature `api/` wrapper (`service_role`), never PostgREST `INSERT` on `message_dispatches`.
- [ ] No `dangerouslySetInnerHTML` or raw HTML built for MMD payloads in the client.
- [ ] Push/email copy changes add or update rows in `message_templates`, not producer strings.
- [ ] Variables match `variable_schema` (see seeds in `20260621100000_create_message_dispatcher_schema_enums_tables.sql`).

## Related docs

- `operator-runbook-immutable-fields.md`
- `design.md` §3.2, §5.1, §11.4–11.5
