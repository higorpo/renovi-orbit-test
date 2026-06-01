# CNS visual states (task 113)

Server-driven status fields are the source of truth (`conversation.status`, `proposal.status`).

## Conversation (`CnsConversationStatus`)

| Status | List item | Header badge | Token key |
|--------|-----------|--------------|-----------|
| `ACTIVE` | Full weight | Optional (hidden in list) | `CONVERSATION_STATUS_TOKENS.ACTIVE` |
| `INACTIVE` | Muted (`opacity-80`) + badge | Badge + icon | `INACTIVE` |
| `CLOSED` | More muted + badge | Badge + icon | `CLOSED` |

Implementation: `utils/conversationVisualState.ts`, `ConversationStatusBadge`.

## Proposal card (`ProposalStatus`)

| Status | Surface | CTA |
|--------|---------|-----|
| `PENDING` | Primary border | Client: Aceitar (primary), Recusar, Pedir revisão |
| `ACCEPTED` | Success tint + `CheckCircle2` | None |
| `EXPIRED` | Muted/disabled surface + `Clock` | None |
| `REJECTED*` | Destructive tint + `XCircle` | None |

Icons accompany headlines (WCAG — not color alone). Touch targets: `min-h-11` on banner and card CTAs; `focus-visible:ring-2` on interactive controls.

## Toasts

- Accept / reject / revision: `useProposalClientMutations` (Sonner).
