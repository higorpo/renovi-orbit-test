# Completion criterion as the checklist unit

A completion checklist item is not a generic intake `yes_no`. It is a **completion criterion**: statement, met/not-met, embedded photo evidence, and mandatory justification when not met.

**Decision:** Use a dedicated Dynamic Form block type `completion_criterion`. Checklist allowlist is `{completion_criterion, static_text}` only. Cardinality counts `completion_criterion` (3–12).

**Why not compose `yes_no` + `evidence_images`?** Composition scatters validation, AI prompting, and mobile UX across unrelated intake primitives and recreates systemic fields outside the schema.

**Why stay on Dynamic Form?** Reuse registry, visibility, and rendering pipeline; only the block implementation is domain-specific. Intake `yes_no` / `image_gallery` remain unchanged.

Supersedes top-level `evidence_images` in the checklist allowlist (ADR-0002 still forbids intake `image_gallery` in completion schemas).
