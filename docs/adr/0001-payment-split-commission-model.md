# Payment split and commission model (MVP)

Prestway embeds platform commission in the NetCred `chargeCreate` split: the client pays `base_amount` (proposal price) plus card fees; the provider receives a **frozen** `provider_payout` (`base_amount` minus commission); Prestway receives **100% of the remainder** (`charge_amount − provider_payout`), which includes commission plus gross card-fee pass-through; NetCred MDR is deducted proportionally via `isLiable: true`, so Prestway's bank net ≈ commission.

**Canonical example:** provider quotes R$ 1.000 → UI shows provider R$ 850 receivable → client charged R$ 1.030 → split: provider `FIXED_AMOUNT` R$ 850, Prestway `PERCENTAGE` 100% of R$ 180 → after MDR (~R$ 30), Prestway net ~R$ 150.

**Why not "provider gets full base_amount"?** That model leaves no room for platform take rate in the split. Commission must be explicit in `provider_payout` frozen at `accept_proposal`; only card fees may drift at T-2.

**Why freeze commission at accept?** Providers see net receivable before the client accepts; changing commission between accept and charge would break trust.

**Refund clawback:** ToS §2.2 tiers apply to `base_amount`; clawback is proportional on `provider_payout` and Prestway share: `refunded_amount × (provider_payout / paid_amount)`.

**Considered alternatives:** (1) commission billed offline — rejected, commission must flow in NetCred split; (2) recalculate commission at T-2 — rejected, provider payout is contractual at accept.

See also: [`docs/payment-system/CONTEXT.md`](../payment-system/CONTEXT.md).
