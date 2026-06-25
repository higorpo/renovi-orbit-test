"""Traceability matrix: Req AC (GIVEN blocks) → design section → tasks → tests."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

REQUIREMENTS_PATH = Path(__file__).parent / "payment-system-requirements.md"

# design.md §12 — primary implementation section per requirement
DESIGN_SECTION: dict[int, str] = {
    1: "§5.1, §4.5.4",
    2: "§6.3, §3.2",
    3: "§4.1.1, §3.4, §3.11",
    4: "§4.1.2",
    5: "§4.2.1, §4.2.2",
    6: "§4.2.3, §3.3, §11.1",
    7: "§4.3, §3.12",
    8: "§4.4.1, §4.4.2",
    9: "§3.0, §3.5, §4.4.1",
    10: "§4.5, §5.3",
    11: "§4.6, §8.1",
    12: "§4.5.2, §1.7.9",
    13: "§4.11",
    14: "§4.12, §1.7.7",
    15: "§4.8, §1.7.5",
    16: "§4.7.1",
    17: "§4.7.3, §3.7",
    18: "§4.7.3, §4.7.2",
    19: "§4.7.4, §3.8",
    20: "§4.9",
    21: "§10.1",
    22: "§10.3, §3.9",
    23: "§7, §4.5.1",
    24: "§11.1, §4.2.3",
    25: "§3.12, §5.2",
    26: "§3 (all)",
    27: "§4.3.2, §4.4.1",
    28: "§3.3, §5.2",
    29: "§4.1.1, §1.7.6",
    30: "§3.10, §4.5.2",
    31: "§4.2.2, §4.11",
    32: "§4.13",
    33: "§4.10",
}

# Per-requirement AC index → (tasks, tests, notes)
# tests use T-prefixed task ids reserved for verification tasks
AC_MAP: dict[tuple[int, int], tuple[list[int], list[int], str]] = {
    # Req 1 — PaymentProvider abstraction (7 ACs)
    (1, 1): ([60, 61], [93], "Route all ops through PaymentProvider interface"),
    (1, 2): ([61, 63], [93], "NetCred field encapsulation in adapter"),
    (1, 3): ([61, 62], [93, 129], "ProviderAuthError single refresh retry"),
    (1, 4): ([60, 61], [93], "Future adapter via gateway_slug routing (Option A constant)"),
    (1, 5): ([60, 61], [93], "Discriminated union paymentMethod types"),
    (1, 6): ([61, 65], [93], "getTransaction null = no prior charge"),
    (1, 7): ([61, 68], [93], "RefundError ALREADY_REFUNDED idempotent"),
    # Req 2 — JWT lifecycle (5)
    (2, 1): ([6, 62], [93], "Read cache; refresh if expires_at - now() < 60min"),
    (2, 2): ([6, 62], [93, 129], "SELECT FOR UPDATE serializes refresh"),
    (2, 3): ([6, 62, 90], [93], "Upsert token + expires_at; Vault for credentials"),
    (2, 4): ([62, 29, 82], [129], "AUTH_FAILURE CRITICAL; abort charge; FAILED without attempt increment"),
    (2, 5): ([62, 82], [129], "Sandbox assertion in production"),
    # Req 3 — KYC (8)
    (3, 1): ([77], [94], "Blocking KYC screen on dashboard"),
    (3, 2): ([15, 21, 106], [115], "CPF natural person fields validation"),
    (3, 3): ([15, 21, 106], [115], "CNPJ legal entity fields validation"),
    (3, 4): ([21, 109], [115], "Atomic KYC submit + DOCUMENTS_SUBMITTED + MMD"),
    (3, 5): ([21, 77, 109], [115], "GAP: UI pending until email_dispatched_at — extend Task 77 with polling"),
    (3, 6): ([26], [115], "match_provider_jobs empty if not ACTIVE"),
    (3, 7): ([27], [115], "cns_initiate_conversation denied if not credentialed"),
    (3, 8): ([26, 27, 88], [115], "SUSPENDED blocking + support message"),
    # Req 4 — onboarding cron (8)
    (4, 1): ([41, 57, 69], [122], "Daily cron batch size from platform_constants"),
    (4, 2): ([69], [122], "Single GraphQL POST with 50 aliases"),
    (4, 3): ([42, 109], [122], "ACTIVE + bankAccounts → activation RPC + push"),
    (4, 4): ([41, 69], [122], "Empty edges → no-op"),
    (4, 5): ([43], [122], "Non-ACTIVE companyState → UNDER_NETCRED_REVIEW"),
    (4, 6): ([69, 82], [122], "Multiple edges → WARNING Sentry; skip activation"),
    (4, 7): ([43, 82], [122], "ACTIVE without bankAccounts → UNDER_NETCRED_REVIEW"),
    (4, 8): ([69], [122], "Sequential batches of 50 + inter-batch delay"),
    # Req 5 — checkout stepper (10)
    (5, 1): ([19, 71], [94], "Step resolution CPF→phone→card order"),
    (5, 2): ([72], [94], "CPF validation client + server"),
    (5, 3): ([72, 123], [94], "Persist CPF; step not shown again"),
    (5, 4): ([72], [94], "Phone step explanation copy"),
    (5, 5): ([74], [94], "Full card form when no saved cards"),
    (5, 6): ([74, 78], [94], "Saved card selection UI"),
    (5, 7): ([74, 75], [94], "Pass card_brand to installment RPC"),
    (5, 8): ([73], [94], "ClearSale sessionId UUID on card step mount"),
    (5, 9): ([73], [94], "Async fp.js loader"),
    (5, 10): ([73], [94], "Capacitor WebView uses Browser SDK"),
    # Req 6 — PCI tokenization (7)
    (6, 1): ([64, 74], [94], "HTTPS to tokenize EF only; no cache"),
    (6, 2): ([64, 61], [93], "paymentProfileCreate persist=false; billingAddress required"),
    (6, 3): ([20, 64], [115], "INSERT client_card_tokens metadata only"),
    (6, 4): ([64], [93], "Tokenization failure → no partial record"),
    (6, 5): ([64, 78], [94], "Profile add card reuses same EF"),
    (6, 6): ([35, 67], [118], "PAYMENT_PROFILE_TOKENIZE webhook → TOKENIZATION_FAILED"),
    (6, 7): ([35, 126], [118], "PAYMENT_PROFILE_EXPIRING → notify update method"),
    # Req 7 — installments + HMAC (7)
    (7, 1): ([18, 75], [117], "RPC-only fee computation at installment step"),
    (7, 2): ([17, 18], [117], "Read rates from platform_constants"),
    (7, 3): ([17, 18], [117], "Fee formula + banker's rounding on installment_amount"),
    (7, 4): ([18, 90], [117], "HMAC-SHA256 via Vault; 10min TTL"),
    (7, 5): ([25, 18], [117], "accept_proposal constant-time HMAC verify"),
    (7, 6): ([17, 28], [117], "Cron uses payment_calculate_charge_amount not HMAC"),
    (7, 7): ([17, 28], [117], "Fee drift intentional at charge time"),
    # Req 8 — accept_proposal (9)
    (8, 1): ([25, 76], [117, 95], "Required payment params on accept_proposal"),
    (8, 2): ([25], [117, 95], "Single TX schedule + audit CHARGE_SCHEDULED"),
    (8, 3): ([25], [117], "pricing_signature validation"),
    (8, 4): ([25, 3], [117], "Emergency charge_scheduled_at = now()"),
    (8, 5): ([25], [117], "PAYMENT_TOKEN_INACTIVE rejection"),
    (8, 6): ([25], [117], "PROVIDER_NOT_CREDENTIALED rejection"),
    (8, 7): ([25], [92], "Idempotent retry via idempotency_key"),
    (8, 8): ([23], [117], "payment_update_method without re-accept"),
    (8, 9): ([25], [], "DEFERRED: PIX payment method — out of MVP scope"),
    # Req 9 — scheduling persistence (5)
    (9, 1): ([9, 25], [115], "payment_schedules column completeness at accept"),
    (9, 2): ([87], [119], "Pre-charge cancel → CANCELLED same TX"),
    (9, 3): ([24, 86], [119], "Reschedule recalculates charge_scheduled_at + audit"),
    (9, 4): ([86], [119], "Post-PAID reschedule: slot only; schedule stays PAID"),
    (9, 5): ([86], [119], "Reject reschedule after EXECUTED/COMPLETED"),
    # Req 10 — T-2 charge cron (11)
    (10, 1): ([28], [116, 99], "Eligibility filters in claim RPC"),
    (10, 2): ([28], [116], "SKIP LOCKED lease + attempt increment same TX"),
    (10, 3): ([28, 29, 63, 65], [122], "charge_amount + split + ClearSale fields at charge"),
    (10, 4): ([29, 31, 65], [122], "PAID → CONFIRMED + notifications"),
    (10, 5): ([29, 31], [122], "IN_ANALYSIS path + client notification"),
    (10, 6): ([29, 31, 126], [122], "REJECTED → FAILED_PERMANENT + notifications"),
    (10, 7): ([29, 31, 126], [122], "Retryable → FAILED + next_retry_at"),
    (10, 8): ([29], [122], "Exhausted retries → FAILED_PERMANENT"),
    (10, 9): ([65, 61], [93, 97], "Timeout → getTransaction first"),
    (10, 10): ([61, 65, 29], [93], "referenceCode conflict → getTransaction reconcile"),
    (10, 11): ([65, 122], [122], "Per-schedule error isolation in EF"),
    # Req 11 — retry semantics (7)
    (11, 1): ([28], [116], "FAILED auto re-attempt when eligible"),
    (11, 2): ([29], [116], "next_retry_at from platform_constants interval"),
    (11, 3): ([29], [116], "Terminal errors → FAILED_PERMANENT immediately"),
    (11, 4): ([29], [116], "max_attempts exhausted → FAILED_PERMANENT"),
    (11, 5): ([30, 66, 29], [96], "Manual attempt semantics"),
    (11, 6): ([30, 23, 66], [96], "Manual card replacement before charge"),
    (11, 7): ([28], [116], "Re-evaluate against current max_charge_attempts constant"),
    # Req 12 — notifications (6)
    (12, 1): ([31, 126, 65], [122], "PAID success Push+Email bypass both parties"),
    (12, 2): ([31, 126], [122], "FAILED retryable client-only notification"),
    (12, 3): ([31, 126], [122], "FAILED_PERMANENT client+provider notifications"),
    (12, 4): ([31, 126], [122], "IN_ANALYSIS client push"),
    (12, 5): ([31, 126, 109], [122], "First failure provider non-financial push — verify matrix in Task 126"),
    (12, 6): ([31, 66], [96], "Manual success notifications"),
    # Req 13 — manual payment (6)
    (13, 1): ([79], [96], "Efetuar Pagamento button visibility gate"),
    (13, 2): ([79, 66], [96], "Manual flow UI: card + installment + amount"),
    (13, 3): ([30, 66], [96], "Precondition validation + fresh ClearSale session"),
    (13, 4): ([66, 29, 31], [96], "Manual PAID success path"),
    (13, 5): ([79, 66], [96], "Terminal error inline UI PT-BR"),
    (13, 6): ([30, 79], [96], "T-12h gate SERVICE_AUTO_CANCELLED"),
    # Req 14 — auto-cancel T-12h (9)
    (14, 1): ([44, 52], [119, 120], "Selection criteria payment_service_execution_at - 12h"),
    (14, 2): ([44, 52], [119], "Atomic cancel service + schedule + audit"),
    (14, 3): ([44, 52, 126], [119], "Post-cancel MMD bypass notifications"),
    (14, 4): ([44, 52], [120], "IN_ANALYSIS excluded before T-12h"),
    (14, 5): ([44, 52, 113], [119, 120], "IN_ANALYSIS at T-12h cancel + gateway void"),
    (14, 6): ([44, 52], [119], "Skip PAID records"),
    (14, 7): ([44, 52], [119], "Idempotent on already CANCELLED"),
    (14, 8): ([44, 88, 126], [119], "SUSPENDED immediate client notify + skip charge"),
    (14, 9): ([44, 88], [119], "SUSPENDED T-12h cancel PROVIDER_SUSPENDED"),
    # Req 15 — cancel/refund (12)
    (15, 1): ([38, 68], [118], ">48h cancel refund base_amount 100%"),
    (15, 2): ([38, 68], [118], "12-48h cancel 90% base_amount penalty"),
    (15, 3): ([38, 68], [118], "<12h cancel 70% base_amount penalty"),
    (15, 4): ([87], [119], "Pre-PAID cancel no gateway"),
    (15, 5): ([87], [119], "Pre-T2 SCHEDULED cancel no gateway"),
    (15, 6): ([38, 68, 87], [118], "CONFIRMED/EXECUTED paid cancel same tiers"),
    (15, 7): ([87], [119], "COMPLETED not cancellable"),
    (15, 8): ([87, 44], [120], "IN_ANALYSIS cancel blocked until T-12h rule"),
    (15, 9): ([87], [119], "Failed pre-PAID client cancel free"),
    (15, 10): ([38, 68], [118], "Provider cancel full charge_amount refund"),
    (15, 11): ([35, 68], [118], "REFUND_REQUESTED until webhook confirms"),
    (15, 12): ([68, 82, 87], [118], "Refund failure CRITICAL + support escalation"),
    # Req 16 — webhook ingestion (5)
    (16, 1): ([33, 67], [121], "Persist RECEIVED before validation"),
    (16, 2): ([67, 90], [121], "HMAC timingSafeEqual via Vault secret"),
    (16, 3): ([67, 33], [121], "Invalid signature → FAILED + 401"),
    (16, 4): ([35, 67], [121], "Per-event dispatch; unknown → WARN 200"),
    (16, 5): ([34, 55], [118], "Heavy path enqueue + 200 immediate"),
    # Req 17 — webhook idempotency (5)
    (17, 1): ([11, 33], [118], "UNIQUE constraint on ingest"),
    (17, 2): ([33, 35, 67], [118], "Duplicate → is_duplicate + 200 no reprocess"),
    (17, 3): ([35], [118], "Out-of-order regression guard"),
    (17, 4): ([35], [118], "Redundant TRANSACTION_CAPTURE on PAID safe update"),
    (17, 5): ([35], [118], "PAYMENT_PROFILE_DELETE → REVOKED + needs_payment_method_update"),
    # Req 18 — webhook catalog (7)
    (18, 1): ([35], [118], "TRANSACTION_CAPTURE → PAID + CONFIRMED"),
    (18, 2): ([35, 34, 55], [118], "TRANSACTION_UPDATE queued fallback"),
    (18, 3): ([35], [118], "CHARGE_VOID → VOIDED"),
    (18, 4): ([35, 82, 111, 126], [118], "TRANSACTION_DISPUTE → is_disputed + alerts"),
    (18, 5): ([35, 126], [118], "TRANSACTION_REFUND → REFUNDED states"),
    (18, 6): ([35, 126], [118], "PAYMENT_PROFILE_EXPIRING notifications"),
    (18, 7): ([35, 67], [121], "Unknown event WARN + 200"),
    # Req 19 — dead letter (4)
    (19, 1): ([35, 55], [118], "Failure → FAILED + retry_count"),
    (19, 2): ([55, 37], [118], "Exponential backoff retry schedule"),
    (19, 3): ([55, 82], [118], "retry_count>=3 → DEAD_LETTER + CRITICAL"),
    (19, 4): ([49, 105], [118], "Operator reset to RECEIVED"),
    # Req 20 — reconciliation polling (4)
    (20, 1): ([39, 58, 70], [122], "Stale intermediate state selection"),
    (20, 2): ([40, 70, 35], [122], "IN_ANALYSIS reconcile via getTransaction"),
    (20, 3): ([40, 70, 82], [122], "Network fail increment reconciliation_failure_count"),
    (20, 4): ([40, 70, 35], [122], "REFUND_REQUESTED reconcile from gateway state"),
    # Req 21 — Sentry (7)
    (21, 1): ([82], [122], "EF Sentry transaction init tags"),
    (21, 2): ([82, 65], [122], "Gateway span attributes"),
    (21, 3): ([82], [122], "captureException with payment context"),
    (21, 4): ([82, 29], [122], "FAILED_PERMANENT WARNING with failure_codes"),
    (21, 5): ([82, 55], [118], "DEAD_LETTER CRITICAL alert"),
    (21, 6): ([82, 62, 129], [129], "tokenAuth CRITICAL alert"),
    (21, 7): ([82, 44, 52], [119], "Auto-cancel WARNING event"),
    # Req 22 — audit log (5)
    (22, 1): ([13, 29, 35], [115], "Audit INSERT same TX as schedule transition"),
    (22, 2): ([38, 68], [115], "REFUND_SUBMITTED audit fields"),
    (22, 3): ([76, 25], [94], "PAYMENT_TERMS_ACCEPTED audit at accept"),
    (22, 4): ([50, 105], [115], "Lifecycle reconstructable from audit"),
    (22, 5): ([13, 84, 127], [115], "INSERT-only permissions + triggers"),
    # Req 23 — concurrency (5)
    (23, 1): ([28], [116, 92], "SKIP LOCKED single winner"),
    (23, 2): ([32, 56], [97], "Janitor orphan recovery paths"),
    (23, 3): ([61, 65], [93], "referenceCode conflict getTransaction"),
    (23, 4): ([30, 66], [96, 116], "Manual vs cron 409 PAYMENT_ALREADY_IN_PROGRESS"),
    (23, 5): ([28], [116], "attempt_count atomic with PROCESSING"),
    # Req 24 — PCI/security (7)
    (24, 1): ([64, 74], [94], "Card data only to tokenize EF"),
    (24, 2): ([7], [115], "No PAN/CVV columns schema audit"),
    (24, 3): ([67], [121], "timingSafeEqual webhook HMAC"),
    (24, 4): ([67, 89], [121], "Webhook rate limiting"),
    (24, 5): ([18, 90], [117], "INSTALLMENT_SIGNING_SECRET in Vault"),
    (24, 6): ([7, 115], [115], "client_card_tokens RLS owner-only SELECT"),
    (24, 7): ([90, 62], [93], "NetCred credentials Vault-only"),
    # Req 25 — platform_constants (5)
    (25, 1): ([4, 17, 18], [117], "Rate updates without redeploy"),
    (25, 2): ([4], [117], "Required fee rate keys seeded"),
    (25, 3): ([4], [117], "Operational limit keys seeded"),
    (25, 4): ([17, 18], [117], "Missing key safe fallback + WARN"),
    (25, 5): ([17, 18], [117], "ROUND_HALF_UP charge formula parity"),
    # Req 26 — data model (9) — AC1 diverges: no payment_providers table (Option A)
    (26, 1): ([60], [], "DIVERGENT: Req AC mentions payment_providers table; design Option A uses constants.ts — no registry table"),
    (26, 2): ([6], [115], "payment_gateway_tokens schema"),
    (26, 3): ([7], [115], "client_card_tokens schema"),
    (26, 4): ([9], [115], "payment_schedules schema"),
    (26, 5): ([10], [115], "payment_attempts schema"),
    (26, 6): ([11], [115], "payment_webhook_events schema"),
    (26, 7): ([13], [115], "payment_audit_log schema"),
    (26, 8): ([8], [115], "provider_gateway_accounts schema"),
    (26, 9): ([9, 10, 11, 13, 7, 8], [115], "Required indexes"),
    # Req 27 — checkout trust UI (4)
    (27, 1): ([74, 76], [94], "Payment partner disclosure block"),
    (27, 2): ([76, 25], [94], "PAYMENT_TERMS_ACCEPTED server audit"),
    (27, 3): ([75], [94], "Installment display with total_with_fees"),
    (27, 4): ([76, 25], [95], "Charge timing disclosure before confirm"),
    # Req 28 — saved cards (4)
    (28, 1): ([78], [94], "Profile list ACTIVE tokens"),
    (28, 2): ([78, 64], [94], "Shared card component + tokenize EF"),
    (28, 3): ([22, 78], [94], "Block revoke with linked SCHEDULED/FAILED"),
    (28, 4): ([22], [94], "Revoke → REVOKED local only"),
    # Req 29 — marketplace gate (6)
    (29, 1): ([26], [115], "match_provider_jobs gate"),
    (29, 2): ([27], [115], "Chat initiation gate"),
    (29, 3): ([25], [117], "accept_proposal provider ACTIVE check"),
    (29, 4): ([42, 109], [122], "Activation push on credentialing"),
    (29, 5): ([26, 27, 88], [115], "SUSPENDED same denial as pending"),
    (29, 6): ([88, 44, 28], [119], "No auto-resume charge after reactivation — ops manual"),
    # Req 30 — event-driven (3)
    (30, 1): ([14, 85, 29, 35], [115], "payment_events on domain transitions"),
    (30, 2): ([31, 126], [122], "MMD decoupled from charge TX"),
    (30, 3): ([14, 85], [], "GAP: analytics derivation from payment_events — post-MVP consumer"),
    # Req 31 — ClearSale (12)
    (31, 1): ([73], [94], "UUID v4 on card step mount; stable in session"),
    (31, 2): ([73], [94], "Async fp.js injection pattern"),
    (31, 3): ([73], [94], "Capacitor WebView Browser SDK"),
    (31, 4): ([114], [94], "VITE_CLEARSALE_APP_KEY from env"),
    (31, 5): ([73], [94], "New UUID on checkout re-entry"),
    (31, 6): ([25, 76], [95], "clearsale_session_id in accept_proposal RPC payload"),
    (31, 7): ([25, 76], [95], "DIVERGENT: Req AC says accept EF for IP capture; design uses RPC p_client_ip from client"),
    (31, 8): ([65, 29], [122], "chargeCreate sessionId + customerIp from schedule row"),
    (31, 9): ([73, 79, 66], [96], "Manual payment fresh ClearSale UUID"),
    (31, 10): ([35, 9], [118], "Keep clearsale_session_id through IN_ANALYSIS"),
    (31, 11): ([64, 74], [94], "billingAddress required before tokenize"),
    (31, 12): ([114, 90], [], "GAP: ops confirmation ClearSale sandbox AppKey with NetCred — runbook only"),
    # Req 32 — service completion (6)
    (32, 1): ([48, 80], [94], "Provider mark EXECUTED date gate"),
    (32, 2): ([108, 80], [94], "Client confirm COMPLETED"),
    (32, 3): ([47, 54], [119], "Auto-complete after 24h system"),
    (32, 4): ([47, 108], [119], "Dispute does not block completion"),
    (32, 5): ([112, 81], [94], "D+30 settlement disclosure from paid_at"),
    (32, 6): ([48], [94], "INVALID_STATUS_TRANSITION guard"),
    # Req 33 — pre-charge notification (6)
    (33, 1): ([45, 46, 53], [119], "Claim SCHEDULED within 24h of charge_scheduled_at"),
    (33, 2): ([45, 53, 126], [119], "Client Push+Email; no provider notification"),
    (33, 3): ([45, 53], [119], "Set upcoming_charge_notified_at atomically"),
    (33, 4): ([45, 53], [119], "Skip when emergency scheduling"),
    (33, 5): ([24, 86], [119], "Reset upcoming_charge_notified_at on reschedule"),
    (33, 6): ([23], [119], "payment_update_method does NOT reset notified_at"),
}


@dataclass
class AcRow:
    ac_id: str
    req: int
    ac_num: int
    when_summary: str
    then_summary: str
    design_section: str
    task_ids: list[int]
    test_ids: list[int]
    notes: str
    coverage: str  # COVERED | PARTIAL | GAP | DIVERGENT


def _coverage(notes: str, tasks: list[int], tests: list[int]) -> str:
    if notes.startswith("DIVERGENT:"):
        return "DIVERGENT"
    if notes.startswith("GAP:"):
        return "GAP" if not tasks else "PARTIAL"
    if "— GAP:" in notes or "GAP:" in notes:
        return "PARTIAL" if tasks else "GAP"
    if notes.startswith("DEFERRED:"):
        return "PARTIAL"
    if not tests and tasks:
        return "PARTIAL"
    return "COVERED"


def parse_requirements() -> list[tuple[int, int, str, str]]:
    text = REQUIREMENTS_PATH.read_text(encoding="utf-8")
    sections = re.split(r"\n## Requirement (\d+):[^\n]*\n", text)[1:]
    parsed: list[tuple[int, int, str, str]] = []
    for i in range(0, len(sections), 2):
        req_num = int(sections[i])
        body = sections[i + 1].split("\n---")[0]
        parts = re.split(r"\n\*\*GIVEN\*\*", body)
        for idx, part in enumerate(parts[1:], 1):
            when_m = re.search(r"\*\*WHEN\*\*\s*([^\n]+)", part)
            then_m = re.search(r"\*\*THEN\*\*\s*(.+?)(?=\n\*\*GIVEN\*\*|\Z)", part, re.S)
            when_t = when_m.group(1).strip() if when_m else ""
            then_t = re.sub(r"\s+", " ", then_m.group(1).strip()) if then_m else ""
            parsed.append((req_num, idx, when_t, then_t))
    return parsed


def build_matrix() -> list[AcRow]:
    rows: list[AcRow] = []
    for req, ac_num, when_t, then_t in parse_requirements():
        key = (req, ac_num)
        if key in AC_MAP:
            tasks, tests, notes = AC_MAP[key]
        else:
            tasks, tests, notes = [], [], "UNMAPPED — add to AC_MAP in _traceability.py"
        design = DESIGN_SECTION.get(req, "§12")
        notes_out = notes
        cov = _coverage(notes, tasks, tests)
        if key not in AC_MAP:
            cov = "GAP"
        rows.append(
            AcRow(
                ac_id=f"Req{req}.AC{ac_num}",
                req=req,
                ac_num=ac_num,
                when_summary=when_t[:140] + ("…" if len(when_t) > 140 else ""),
                then_summary=then_t[:180] + ("…" if len(then_t) > 180 else ""),
                design_section=design,
                task_ids=tasks,
                test_ids=tests,
                notes=notes_out,
                coverage=cov,
            )
        )
    return rows


def format_task_list(ids: list[int]) -> str:
    return ", ".join(str(i) for i in ids) if ids else "—"


def render_markdown_appendix(rows: list[AcRow]) -> str:
    total = len(rows)
    covered = sum(1 for r in rows if r.coverage == "COVERED")
    partial = sum(1 for r in rows if r.coverage == "PARTIAL")
    gap = sum(1 for r in rows if r.coverage == "GAP")
    divergent = sum(1 for r in rows if r.coverage == "DIVERGENT")

    lines = [
        "## Appendix E: Traceability Matrix (Requirements AC → Design → Tasks → Tests)\n",
        "### Legend\n",
        "| Status | Meaning |",
        "|---|---|",
        "| **COVERED** | AC mapped to implementation task(s) and verification test task(s) |",
        "| **PARTIAL** | Implementation mapped; verification incomplete or noted sub-gap in Notes |",
        "| **GAP** | No task mapping — requires new task or AC_MAP entry |",
        "| **DIVERGENT** | Req AC conflicts with design.md; tasks follow design (documented in Notes) |",
        "",
        "**AC ID format:** `Req{N}.AC{M}` = M-th `GIVEN/WHEN/THEN` block under Requirement N in [`payment-system-requirements.md`](./payment-system-requirements.md).\n",
        "### Coverage summary\n",
        f"| Metric | Count |",
        f"|---|---|",
        f"| Total AC rows (`GIVEN` blocks) | {total} |",
        f"| COVERED | {covered} |",
        f"| PARTIAL | {partial} |",
        f"| GAP | {gap} |",
        f"| DIVERGENT | {divergent} |",
        "",
        f"**Machine-readable export:** [`traceability-matrix.csv`](./traceability-matrix.csv) (same rows; import to Jira/Linear).\n",
        "### Known gaps and divergences (action items)\n",
        "| AC ID | Issue | Remediation |",
        "|---|---|---|",
        "| Req3.AC5 | UI polling `email_dispatched_at` not explicit in Task 77 | Extend Task 77 or add sub-task |",
        "| Req8.AC9 | PIX payment method — future MVP+ | Track as deferred; no MVP task |",
        "| Req26.AC1 | Req mentions `payment_providers` table | Design Option A — Task 60; update Req or ADR |",
        "| Req30.AC3 | Analytics pipeline from `payment_events` | Add analytics consumer task post-MVP |",
        "| Req31.AC7 | Req says accept EF for IP; design uses RPC `p_client_ip` | Tasks follow design; reconcile Req wording |",
        "",
        "### Full matrix\n",
        "| AC ID | Req | Design | Tasks | Tests | Status | Notes |",
        "|---|---:|---|---|---|:---:|---|",
    ]
    for r in rows:
        lines.append(
            f"| [{r.ac_id}](#) | {r.req} | {r.design_section} | {format_task_list(r.task_ids)} | "
            f"{format_task_list(r.test_ids)} | **{r.coverage}** | {r.notes.replace('|', '/')} |"
        )
    lines.append("")
    return "\n".join(lines)


def write_csv(rows: list[AcRow], path: Path) -> None:
    import csv

    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "ac_id",
                "requirement",
                "ac_number",
                "design_section",
                "task_ids",
                "test_ids",
                "coverage_status",
                "when_summary",
                "then_summary",
                "notes",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r.ac_id,
                    r.req,
                    r.ac_num,
                    r.design_section,
                    ";".join(str(t) for t in r.task_ids),
                    ";".join(str(t) for t in r.test_ids),
                    r.coverage,
                    r.when_summary,
                    r.then_summary,
                    r.notes,
                ]
            )


def generate_traceability(output_dir: Path) -> tuple[str, Path]:
    rows = build_matrix()
    csv_path = output_dir / "traceability-matrix.csv"
    write_csv(rows, csv_path)
    return render_markdown_appendix(rows), csv_path
