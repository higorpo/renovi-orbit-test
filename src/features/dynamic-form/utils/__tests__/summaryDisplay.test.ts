import { describe, expect, it } from "vitest";
import type { FormData, FormSchema, PreviewSummaryBlockConfig } from "../../types/schema";
import {
  buildSummaryEntries,
  buildSummarySections,
  buildSummarySectionsFromConfig,
  getFormCompleteness,
  INPUT_BLOCK_TYPES,
} from "../summaryDisplay";
import { minimalSchema } from "../../components/DynamicForm/__tests__/fixtures/schemas";

describe("summaryDisplay", () => {
  it("INPUT_BLOCK_TYPES includes expected block types", () => {
    expect(INPUT_BLOCK_TYPES.has("text")).toBe(true);
    expect(INPUT_BLOCK_TYPES.has("preview_summary")).toBe(false);
  });

  describe("buildSummaryEntries", () => {
    it("returns empty array when formData is null or empty", () => {
      expect(buildSummaryEntries(null, minimalSchema)).toEqual([]);
      expect(buildSummaryEntries({}, minimalSchema)).toEqual([]);
    });

    it("returns empty when schema has no steps", () => {
      const schema: FormSchema = {
        ...minimalSchema,
        steps: [],
      };
      expect(buildSummaryEntries({ text1: "a" }, schema)).toEqual([]);
    });

    it("skips empty, null, and empty array values", () => {
      const schema: FormSchema = {
        ...minimalSchema,
        steps: [
          {
            id: "s",
            order: 0,
            title: "S",
            blocks: [
              { id: "a", type: "text", label: "A", required: false, description_ai: "A" },
              { id: "b", type: "text", label: "B", required: false, description_ai: "B" },
              { id: "c", type: "multi_select", label: "C", required: false, description_ai: "C", options: [] },
            ],
          },
        ],
      };
      const entries = buildSummaryEntries(
        { a: "", b: null, c: [] } as Record<string, unknown>,
        schema,
      );
      expect(entries).toEqual([]);
    });

    it("includes filled input blocks in step order", () => {
      const entries = buildSummaryEntries({ text1: "Alice" } as Record<string, unknown>, minimalSchema);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: "text1",
        label: "Name",
        displayValue: "Alice",
        rawValue: "Alice",
      });
    });

    it("skips non-input blocks even when formData has a value for them", () => {
      const schema: FormSchema = {
        ...minimalSchema,
        steps: [
          {
            id: "s",
            order: 0,
            title: "S",
            blocks: [
              { id: "st", type: "static_text", label: "Static", description_ai: "S" },
              { id: "inp", type: "text", label: "Inp", required: false, description_ai: "I" },
            ],
          },
        ],
      };
      const entries = buildSummaryEntries(
        { st: "ignored", inp: "kept" } as Record<string, unknown>,
        schema,
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("inp");
    });

    it("maps emoji from first option when present", () => {
      const schema: FormSchema = {
        ...minimalSchema,
        steps: [
          {
            id: "s",
            order: 0,
            title: "S",
            blocks: [
              {
                id: "m",
                type: "single_select",
                label: "Mood",
                required: false,
                description_ai: "M",
                options: [{ value: "ok", label: "OK", emoji: "✨" }],
              },
            ],
          },
        ],
      };
      const entries = buildSummaryEntries({ m: "ok" } as Record<string, unknown>, schema);
      expect(entries[0].emoji).toBe("✨");
    });
  });

  describe("buildSummarySections", () => {
    it("groups entries by visible step", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "one",
            order: 0,
            title: "First step",
            icon: "📝",
            blocks: [
              { id: "x", type: "text", label: "X", required: true, description_ai: "X" },
            ],
          },
          {
            id: "two",
            order: 1,
            title: "Second step",
            blocks: [
              { id: "y", type: "text", label: "Y", required: true, description_ai: "Y" },
            ],
          },
        ],
      };
      const formData: FormData = { x: "vx", y: "vy" };
      const sections = buildSummarySections(schema, formData);
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe("First step");
      expect(sections[0].entries[0].displayValue).toBe("vx");
      expect(sections[1].entries[0].displayValue).toBe("vy");
    });

    it("uses default icon when step has no icon", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "one",
            order: 0,
            title: "Only",
            blocks: [{ id: "z", type: "text", label: "Z", required: true, description_ai: "Z" }],
          },
        ],
      };
      const sections = buildSummarySections(schema, { z: "zval" });
      expect(sections[0].icon).toBe("📋");
    });

    it("skips steps that only have non-input blocks after visibility filter", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "empty_inputs",
            order: 0,
            title: "No inputs",
            blocks: [
              { id: "st", type: "static_text", label: "Note", description_ai: "N" },
            ],
          },
          {
            id: "with_input",
            order: 1,
            title: "Has field",
            blocks: [{ id: "z", type: "text", label: "Z", required: true, description_ai: "Z" }],
          },
        ],
      };
      const sections = buildSummarySections(schema, { z: "v" });
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe("Has field");
    });
  });

  describe("buildSummarySectionsFromConfig", () => {
    it("builds sections from config field ids", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "one",
            order: 0,
            title: "S",
            blocks: [
              { id: "f1", type: "text", label: "Field 1", required: true, description_ai: "F1" },
              { id: "f2", type: "static_text", label: "Static", description_ai: "S" },
            ],
          },
        ],
      };
      const config: PreviewSummaryBlockConfig = {
        sections: [
          { id: "sec", title: "Summary", icon: "✅", fieldIds: ["f1", "f2", "missing"] },
        ],
      };
      const sections = buildSummarySectionsFromConfig(schema, { f1: "v1" }, config);
      expect(sections).toHaveLength(1);
      expect(sections[0].entries).toHaveLength(1);
      expect(sections[0].entries[0].id).toBe("f1");
    });

    it("returns empty when no entries resolve", () => {
      const config: PreviewSummaryBlockConfig = { sections: [{ id: "s", title: "T", fieldIds: ["nope"] }] };
      expect(buildSummarySectionsFromConfig(minimalSchema, {}, config)).toEqual([]);
    });

    it("treats missing sections as empty list", () => {
      expect(buildSummarySectionsFromConfig(minimalSchema, { text1: "x" }, {})).toEqual([]);
    });

    it("uses default section icon when config section omits icon", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "one",
            order: 0,
            title: "S",
            blocks: [
              { id: "f1", type: "text", label: "Field 1", required: true, description_ai: "F1" },
            ],
          },
        ],
      };
      const config: PreviewSummaryBlockConfig = {
        sections: [{ id: "sec", title: "Summary", fieldIds: ["f1"] }],
      };
      const sections = buildSummarySectionsFromConfig(schema, { f1: "v1" }, config);
      expect(sections[0].icon).toBe("📋");
    });
  });

  describe("getFormCompleteness", () => {
    it("returns zeros when no input blocks", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "one",
            order: 0,
            title: "S",
            blocks: [{ id: "st", type: "static_text", label: "S", description_ai: "S" }],
          },
        ],
      };
      expect(getFormCompleteness(schema, {})).toEqual({ total: 0, filled: 0, percentage: 0 });
    });

    it("counts filled vs total input blocks", () => {
      const c = getFormCompleteness(minimalSchema, { text1: "ok" });
      expect(c.total).toBe(1);
      expect(c.filled).toBe(1);
      expect(c.percentage).toBe(100);
    });

    it("percentage rounds correctly for partial fill", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "one",
            order: 0,
            title: "S",
            blocks: [
              { id: "a", type: "text", label: "A", required: true, description_ai: "A" },
              { id: "b", type: "text", label: "B", required: true, description_ai: "B" },
            ],
          },
        ],
      };
      const c = getFormCompleteness(schema, { a: "x" });
      expect(c.total).toBe(2);
      expect(c.filled).toBe(1);
      expect(c.percentage).toBe(50);
    });

    it("counts non-empty multi_select values as filled", () => {
      const schema: FormSchema = {
        version: "2.0",
        id: "s",
        title: "T",
        metadata: { categorySlug: "x", categoryId: null, status: "draft" },
        config: { showProgressBar: true },
        steps: [
          {
            id: "one",
            order: 0,
            title: "S",
            blocks: [
              {
                id: "tags",
                type: "multi_select",
                label: "Tags",
                required: false,
                description_ai: "T",
                options: [
                  { value: "a", label: "A" },
                  { value: "b", label: "B" },
                ],
              },
            ],
          },
        ],
      };
      const c = getFormCompleteness(schema, { tags: ["a", "b"] });
      expect(c.total).toBe(1);
      expect(c.filled).toBe(1);
      expect(c.percentage).toBe(100);
    });
  });
});
