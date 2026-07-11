import { describe, it, expect } from "vitest";
import type { FormBlockType } from "../../../types";
import {
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_ICONS,
  VISIBILITY_OPERATORS,
  createBlock,
  createStep,
  createEmptySchema,
  createDefaultVisibilityRule,
  optionFromTemplate,
} from "../builderDefaults";

describe("builderDefaults", () => {
  it("has label and icon for every FormBlockType key used in BLOCK_TYPE_LABELS", () => {
    const types = Object.keys(BLOCK_TYPE_LABELS) as FormBlockType[];
    expect(types.length).toBeGreaterThan(10);
    for (const t of types) {
      expect(BLOCK_TYPE_LABELS[t].length).toBeGreaterThan(0);
      expect(BLOCK_TYPE_ICONS[t].length).toBeGreaterThan(0);
    }
  });

  it("VISIBILITY_OPERATORS lists all operators with labels", () => {
    expect(VISIBILITY_OPERATORS.some((o) => o.value === "equals")).toBe(true);
    expect(VISIBILITY_OPERATORS.some((o) => o.value === "isNotEmpty")).toBe(true);
  });

  it("createEmptySchema returns valid 2.0 schema shell", () => {
    const s = createEmptySchema();
    expect(s.version).toBe("2.0");
    expect(Array.isArray(s.steps)).toBe(true);
    expect(s.metadata.categorySlug).toBeDefined();
  });

  it("createStep respects overrides", () => {
    const step = createStep({ order: 3, title: "Custom", id: "fixed-id" });
    expect(step.order).toBe(3);
    expect(step.title).toBe("Custom");
    expect(step.id).toBe("fixed-id");
  });

  it("createBlock sets type-specific defaults for select-like blocks", () => {
    const single = createBlock("single_select");
    expect(single.options?.length).toBeGreaterThan(0);
    const multi = createBlock("multi_select");
    expect(multi.options?.length).toBeGreaterThan(0);
    const gallery = createBlock("image_gallery");
    expect(gallery.config?.columns).toBe(2);
    expect(Array.isArray(gallery.options)).toBe(true);
  });

  it("createBlock merges overrides", () => {
    const b = createBlock("text", { label: "Override", id: "id-1" });
    expect(b.label).toBe("Override");
    expect(b.id).toBe("id-1");
  });

  it("createBlock covers remaining types and default branch", () => {
    expect(createBlock("textarea").placeholder).toBeDefined();
    expect(createBlock("yes_no").type).toBe("yes_no");
    expect(createBlock("date").type).toBe("date");
    expect(createBlock("description_ai").type).toBe("description_ai");
    expect(createBlock("slider").max).toBeDefined();
    expect(createBlock("property_type").options?.length).toBeGreaterThan(0);
    expect(createBlock("urgency").options?.length).toBeGreaterThan(0);
    expect(createBlock("radio").options?.length).toBeGreaterThan(0);
    expect(createBlock("checkbox").options?.length).toBeGreaterThan(0);
    expect(createBlock("conditional_alert").config?.alertType).toBe("info");
    expect(createBlock("static_text").config?.variant).toBe("p");
    expect(createBlock("preview_summary").type).toBe("preview_summary");
    expect(createBlock("number").min).toBe(0);
  });

  it("createBlock preserves provided options and numeric overrides", () => {
    const opts = [{ value: "x", label: "X" }];
    expect(createBlock("single_select", { options: opts }).options).toEqual(opts);
    expect(
      createBlock("number", { min: 2, max: 9, step: 3, unit: "kg" }).unit,
    ).toBe("kg");
    expect(createBlock("property_type", { options: opts }).options).toEqual(opts);
    expect(createBlock("urgency", { options: opts }).options).toEqual(opts);
    expect(
      createBlock("conditional_alert", {
        visibility: [{ dependsOn: "a", operator: "equals", value: "1" }],
      }).visibility?.[0]?.dependsOn,
    ).toBe("a");
  });

  it("createBlock falls back to default option when options array is empty", () => {
    const block = createBlock("checkbox", { options: [] });
    expect(block.options).toEqual([{ value: "opcao_1", label: "Opção 1" }]);
  });

  it("createStep keeps optional description and visibility", () => {
    const step = createStep({
      description: "Desc",
      visibility: [{ dependsOn: "f", operator: "isNotEmpty", value: "" }],
      icon: "🔧",
    });
    expect(step.description).toBe("Desc");
    expect(step.icon).toBe("🔧");
    expect(step.visibility?.[0]?.operator).toBe("isNotEmpty");
  });

  it("optionFromTemplate copies optional fields", () => {
    const rule = createDefaultVisibilityRule();
    expect(rule.operator).toBe("equals");
    const opt = optionFromTemplate(
      {
        label: "L",
        emoji: "x",
        description: "d",
        exclusive: true,
        metadata: { k: 1 },
        image: "img",
        tags: ["t"],
      },
      0,
    );
    expect(opt.emoji).toBe("x");
    expect(opt.exclusive).toBe(true);
    expect(opt.tags).toEqual(["t"]);
    const optFixed = optionFromTemplate({ value: "v", label: "L2" }, 0);
    expect(optFixed.value).toBe("v");
    const optIndex = optionFromTemplate({ label: "L" }, 2);
    expect(optIndex.value).toMatch(/opt_/);
  });
});
