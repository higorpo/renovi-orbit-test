-- pgTAP: Task 19 — enrichment_validate_checklist_schema allowlist/cardinality matrix.

begin;

select plan(8);

select ok(
  public.enrichment_validate_checklist_schema(
    $schema${
      "version": 1,
      "blocks": [
        {
          "id": "c1",
          "type": "completion_criterion",
          "label": "Critério 1?",
          "required": true,
          "config": { "requires_evidence_when_met": true, "evidence_min": 1, "evidence_max": 5 }
        },
        {
          "id": "c2",
          "type": "completion_criterion",
          "label": "Critério 2?",
          "required": true,
          "config": { "requires_evidence_when_met": false, "evidence_min": 1, "evidence_max": 5 }
        },
        {
          "id": "c3",
          "type": "completion_criterion",
          "label": "Critério 3?",
          "required": true,
          "config": { "requires_evidence_when_met": false, "evidence_min": 1, "evidence_max": 5 }
        },
        {
          "id": "hint",
          "type": "static_text",
          "content": "Instrução"
        }
      ]
    }$schema$::jsonb
  ),
  'valid 3 criteria + static_text passes'
);

select ok(
  not public.enrichment_validate_checklist_schema(
    $schema${
      "version": 1,
      "blocks": [
        {
          "id": "c1",
          "type": "completion_criterion",
          "label": "Only one",
          "required": true,
          "config": { "requires_evidence_when_met": false }
        }
      ]
    }$schema$::jsonb
  ),
  'cardinality below min fails'
);

select ok(
  not public.enrichment_validate_checklist_schema(
    $schema${
      "version": 1,
      "blocks": [
        { "id": "y1", "type": "yes_no", "label": "x" },
        {
          "id": "c1",
          "type": "completion_criterion",
          "label": "A",
          "config": { "requires_evidence_when_met": false }
        },
        {
          "id": "c2",
          "type": "completion_criterion",
          "label": "B",
          "config": { "requires_evidence_when_met": false }
        },
        {
          "id": "c3",
          "type": "completion_criterion",
          "label": "C",
          "config": { "requires_evidence_when_met": false }
        }
      ]
    }$schema$::jsonb
  ),
  'yes_no block rejected by allowlist'
);

select ok(
  not public.enrichment_validate_checklist_schema(
    $schema${
      "version": 1,
      "blocks": [
        {
          "id": "c1",
          "type": "completion_criterion",
          "label": "A",
          "config": { "requires_evidence_when_met": false }
        },
        {
          "id": "c2",
          "type": "completion_criterion",
          "label": "B",
          "config": { "requires_evidence_when_met": false }
        },
        {
          "id": "c3",
          "type": "completion_criterion",
          "label": "C",
          "config": { "requires_evidence_when_met": false }
        },
        { "id": "g1", "type": "image_gallery", "label": "fotos" }
      ]
    }$schema$::jsonb
  ),
  'image_gallery block rejected by allowlist'
);

select ok(
  not public.enrichment_validate_checklist_schema(
    $schema${
      "version": 1,
      "evidence_images": [],
      "blocks": [
        {
          "id": "c1",
          "type": "completion_criterion",
          "label": "A",
          "config": { "requires_evidence_when_met": false }
        },
        {
          "id": "c2",
          "type": "completion_criterion",
          "label": "B",
          "config": { "requires_evidence_when_met": false }
        },
        {
          "id": "c3",
          "type": "completion_criterion",
          "label": "C",
          "config": { "requires_evidence_when_met": false }
        }
      ]
    }$schema$::jsonb
  ),
  'top-level evidence_images rejected'
);

select ok(
  not public.enrichment_validate_checklist_schema(
    $schema${
      "version": 1,
      "blocks": [
        {
          "id": "c1",
          "type": "completion_criterion",
          "label": "A",
          "config": {}
        },
        {
          "id": "c2",
          "type": "completion_criterion",
          "label": "B",
          "config": { "requires_evidence_when_met": false }
        },
        {
          "id": "c3",
          "type": "completion_criterion",
          "label": "C",
          "config": { "requires_evidence_when_met": false }
        }
      ]
    }$schema$::jsonb
  ),
  'missing requires_evidence_when_met fails'
);

select ok(
  not public.enrichment_validate_checklist_schema(null),
  'null schema returns false'
);

select ok(
  not public.enrichment_validate_checklist_schema('[]'::jsonb),
  'non-object schema returns false'
);

select finish();

rollback;
