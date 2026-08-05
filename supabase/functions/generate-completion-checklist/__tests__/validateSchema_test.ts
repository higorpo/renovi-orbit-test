import { assertEquals } from "std/testing/asserts";
import {
  parseChecklistJson,
  validateChecklistSchema,
} from "../validateSchema.ts";

const validSchema = {
  version: 1,
  blocks: [
    {
      id: "crit_work_done",
      type: "completion_criterion",
      label: "O serviço combinado foi executado?",
      required: true,
      config: {
        requires_evidence_when_met: true,
        evidence_min: 1,
        evidence_max: 5,
      },
    },
    {
      id: "crit_area_clean",
      type: "completion_criterion",
      label: "A área ficou limpa?",
      required: true,
      config: { requires_evidence_when_met: false },
    },
    {
      id: "crit_access",
      type: "completion_criterion",
      label: "Horários foram respeitados?",
      required: true,
      config: { requires_evidence_when_met: false },
    },
    {
      id: "static_hint",
      type: "static_text",
      content: "Responda cada critério.",
    },
  ],
};

Deno.test("validateChecklistSchema accepts global seed shape", () => {
  const result = validateChecklistSchema(validSchema);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.schema.blocks.length, 4);
  }
});

Deno.test("validateChecklistSchema rejects evidence_images top-level", () => {
  const result = validateChecklistSchema({
    ...validSchema,
    evidence_images: [],
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "evidence_images_forbidden");
});

Deno.test("validateChecklistSchema rejects too few criteria", () => {
  const result = validateChecklistSchema({
    version: 1,
    blocks: [validSchema.blocks[0], validSchema.blocks[1]],
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "criterion_cardinality");
});

Deno.test("validateChecklistSchema rejects unknown block type", () => {
  const result = validateChecklistSchema({
    version: 1,
    blocks: [
      ...validSchema.blocks.slice(0, 3),
      { type: "image_gallery", id: "x" },
    ],
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "type_not_allowlisted");
});

Deno.test("parseChecklistJson strips markdown fences", () => {
  const parsed = parseChecklistJson("```json\n{\"version\":1,\"blocks\":[]}\n```");
  assertEquals((parsed as { version: number }).version, 1);
});
