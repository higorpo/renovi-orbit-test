# Evidence images block (not intake image_gallery)

Completion checklists need camera/upload evidence. Orbit’s existing Dynamic Form `image_gallery` block is a **catalog image picker** for request-quote intake, not an evidence uploader.

**Decision:** Introduce a dedicated Dynamic Form block type `evidence_images` for the completion checklist allowlist (`yes_no` | `evidence_images` | `static_text`). Keep intake `image_gallery` unchanged.

**Why not reuse `image_gallery` with a mode flag?** Mixing intake catalog UX and execution evidence in one block type couples unrelated validation, storage, and mobile camera flows and risks breaking request-quote forms.

**Why not systemic uploads only (no DF block)?** A first-class block keeps schema generation, requiredness, and rendering inside the Dynamic Form engine used for checklist fill/review.
