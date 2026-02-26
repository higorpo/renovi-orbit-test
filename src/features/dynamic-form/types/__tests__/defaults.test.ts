import { describe, it, expect } from "vitest";
import { normalizeSchema } from "../defaults";

describe("normalizeSchema", () => {
  const minimalSchema = {
    version: "2.0" as const,
    id: "form_1",
    title: "Test Form",
    metadata: {
      categorySlug: "cat",
      categoryId: null,
      status: "draft" as const,
    },
    config: {},
    steps: [],
  };

  it("throws when schema is null", () => {
    expect(() => normalizeSchema(null as unknown as Record<string, unknown>, "cat")).toThrow(
      "Schema must be an object"
    );
  });

  it("throws when schema is not an object", () => {
    expect(() => normalizeSchema("invalid" as unknown as Record<string, unknown>, "cat")).toThrow(
      "Schema must be an object"
    );
  });

  it("throws when version is not 2.0", () => {
    expect(() =>
      normalizeSchema({ ...minimalSchema, version: "1.0" } as unknown as Record<string, unknown>, "cat")
    ).toThrow('Schema version must be "2.0"');
  });

  it("returns schema with default metadata when valid", () => {
    const result = normalizeSchema(minimalSchema, "my-slug");
    expect(result.version).toBe("2.0");
    expect(result.id).toBe("form_1");
    expect(result.title).toBe("Test Form");
    // When schema already has metadata.categorySlug it is preserved
    expect(result.metadata.categorySlug).toBe("cat");
    expect(result.metadata.status).toBe("draft");
    expect(result.metadata.updatedAt).toBeDefined();
    expect(result.steps).toEqual([]);
  });

  it("uses categorySlug parameter when metadata has no categorySlug", () => {
    const noSlug = {
      ...minimalSchema,
      metadata: { ...minimalSchema.metadata, categorySlug: "" },
    };
    const result = normalizeSchema(noSlug, "new-slug");
    expect(result.metadata.categorySlug).toBe("new-slug");
  });

  it("preserves existing config and merges with defaults", () => {
    const withConfig = {
      ...minimalSchema,
      config: { showProgressBar: false },
    };
    const result = normalizeSchema(withConfig, "cat");
    expect(result.config.showProgressBar).toBe(false);
  });

  it("generates id when missing", () => {
    const noId = { ...minimalSchema, id: undefined };
    const result = normalizeSchema(noId as unknown as Record<string, unknown>, "cat");
    expect(result.id).toMatch(/^form_\d+$/);
  });

  it("uses formStatus parameter for status when metadata has no status", () => {
    const noStatus = {
      ...minimalSchema,
      metadata: { categorySlug: "cat", categoryId: null },
    };
    const result = normalizeSchema(
      noStatus as unknown as Record<string, unknown>,
      "cat",
      undefined,
      "active"
    );
    expect(result.metadata.status).toBe("active");
  });
});
