# Chats — client idempotency and retry

Engineering guide for CNS write paths: idempotency keys, PostgREST timeout recovery, and TanStack Query mutation policy.

**Normative:** `docs/chats/design.md` (§3.4, §3.10, §4.9, §8.1–§8.2), `docs/chats/requirements.md` (Req. 14, 26, 27, 30). **Scaling / cron ops:** `docs/chats/cns-scaling.md` (§9.4).

**Server implementation:** `rpc_idempotency_records`, `idempotency_begin` / `idempotency_commit` (migration `20260701102300_create_idempotency_helpers.sql`); message-scoped dedupe in `cns_send_message`; RPC cache in `accept_proposal` and other `chats.*` operations.

---

## Idempotency keys

| Rule | Detail |
|------|--------|
| **One key per logical action** | Generate a new UUID when the user starts a distinct action (send, accept, submit proposal, close, etc.). |
| **Reuse on retry** | Network failure, timeout, or explicit “Tentar novamente” MUST call the same RPC with the **same** `idempotency_key` and the **same** business args. |
| **Never rotate on retry** | A new key on retry can create duplicate messages or double side effects. |
| **Scope differs by layer** | `cns_send_message`: `(chat_id, sender_user_id, idempotency_key)` on `chat_messages`. Other mutations: `(actor_user_id, operation, idempotency_key)` on `rpc_idempotency_records` (e.g. `chats.accept_proposal`). |

Store the key in hook/mutation state for the lifetime of that in-flight action (e.g. ref keyed by `client_message_id` for sends, ref for accept until success or terminal error).

---

## PostgREST timeout after commit (§8.1, R27-AC03, OAC-08)

PostgREST may close the HTTP connection while Postgres has already committed. The client cannot tell “failed” vs “succeeded with no body” from the transport alone.

**Recovery:** re-invoke the **same** RPC with the **same** `idempotency_key` (and unchanged parameters).

| Path | Server behavior on replay |
|------|---------------------------|
| `cns_send_message` | Returns existing `chat_messages` row for the scoped triple; no second insert. |
| `accept_proposal`, `submit_proposal`, … | `idempotency_begin` hits `rpc_idempotency_records` and returns cached `response_body`. |

Treat a successful replay as success in UI: replace optimistic bubble (send) or navigate/refresh from returned payload (accept). Do not show a duplicate error if the replay returns 200 with the original body.

**User-facing copy:** after timeout, prefer “Verificando…” then replay once automatically; if still ambiguous, offer “Tentar novamente” using the **same** key (not a new attempt).

There is no separate “poll status” RPC in v1 — **the mutation RPC is the status query** when keyed idempotently (Req. 27).

---

## TanStack Query mutation policy

CNS mutations MUST NOT rely on React Query’s default mutation retry (transient errors could reorder or confuse idempotency unless every attempt uses the same key).

```ts
useMutation({
  retry: false, // required for CNS writes; see hooks in tasks 86–88
  mutationFn: (vars) => chatsApi.sendMessage({ ...vars, idempotencyKey: vars.idempotencyKey }),
});
```

| Concern | Policy |
|---------|--------|
| Automatic `retry` | `false` for all chat/proposal RPC mutations. |
| Manual retry | User action or a single guarded auto-replay after timeout; always same `idempotency_key`. |
| `retryDelay` / backoff | Not used on mutations; use `retry_after_seconds` from 429 DETAIL for send rate limit (UI timer). |
| Cache updates | On success (including idempotent replay), `invalidateQueries` / `setQueryData` from server body; never mark success without RPC confirmation (Req. 3, 26). |

Queries (`list_chat_messages`, `list_conversations`) may keep global query defaults; only **mutations** need the strict policy.

---

## Send message vs accept proposal

### Send message (`cns_send_message`) — optimistic allowed (task 88, §4.9)

- MAY show an optimistic row (`client_message_id` in payload).
- On RPC success **or** idempotent replay: replace optimistic row with server `message`.
- On hard failure (non-timeout, non-replayable): mark failed; retry button reuses the **same** `idempotency_key`.
- Media upload: retry send with same key; if upload session expired, start a new upload session but keep send key (design §4.6 orphan recovery).

### Accept proposal (`accept_proposal`) — **no optimistic UI** (R30-AC05, Req. 14)

- MUST show loading on the confirm action only; MUST NOT pre-close chats, pre-create `services`, or update proposal/SR status in cache before RPC success.
- MUST block when `navigator.onLine === false` with a clear message (Req. 30).
- On timeout: replay with same `idempotency_key`, `proposal_id`, and `selected_slot`; apply UI only from returned `{ service, proposal }`.
- Concurrent accept: second caller gets `409` / `SR_ALREADY_COMPLETED` after the first commits — do not treat as success.

`negotiation-proposals` owns `AcceptProposalDialog`; it MUST follow this doc and call API layer only (no Supabase in components).

---

## Error handling quick reference

| Situation | Client action |
|-----------|----------------|
| HTTP timeout / network | Same-key RPC replay; then user retry if needed |
| `IDEMPOTENCY_CONFLICT` | New logical action required (args changed under same key) — show error, do not auto-retry |
| `RATE_LIMITED` (429) | Read `retry_after_seconds` from error DETAIL; disable send until elapsed |
| `PROPOSAL_NOT_ACCEPTABLE` / `SR_ALREADY_COMPLETED` | Terminal; refresh timeline; do not replay accept |
| Rollback (4xx/5xx before commit) | Safe to retry with same key |

---

## Observability

When wiring API/hooks (tasks 86+), record:

- `metrics.count('chats.rpc_timeout', 1, { operation })` (or equivalent) on transport timeout before replay.
- Breadcrumb: `operation`, `idempotency_key` (UUID only — no message body), `replay: true|false`.
- Analytics: distinguish `send_failed` vs `send_replayed_success` for funnel quality.

Server logs `cns_idempotency_hit` and `cns_send_message_idempotency_hit` for support correlation.

---

## Implementation checklist (hooks / API)

- [ ] `chats.api.ts` / `negotiation-proposals` API accept `idempotencyKey` on every mutation RPC.
- [ ] `useChatMessages` — stable key per pending send; `retry: false`; optimistic replace on success.
- [ ] `useAcceptProposal` (negotiation-proposals) — `retry: false`; loading only; offline guard; same-key replay helper shared with API.
- [ ] Never call `mutate()` twice in parallel with the same key for accept.

Related tasks: **71** (this doc), **86–88** (API + hooks), **98** (accept dialog), **82** (statement_timeout + accept replay path).
