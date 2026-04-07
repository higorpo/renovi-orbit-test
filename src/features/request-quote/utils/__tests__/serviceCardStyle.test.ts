import { describe, it, expect } from "vitest";
import {
  getServiceCardStyle,
  SERVICE_COLOR_KEYS,
  type ServiceColorKey,
} from "../serviceCardStyle";

describe("serviceCardStyle", () => {
  describe("getServiceCardStyle", () => {
    it("returns default icon and slate color when service is null", () => {
      const result = getServiceCardStyle(null);
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.slate);
    });

    it("returns default icon and slate color when service is undefined", () => {
      const result = getServiceCardStyle(undefined);
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.slate);
    });

    it("returns default icon when icon_key is empty string", () => {
      const result = getServiceCardStyle({ icon_key: "", color_key: "slate" });
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.slate);
    });

    it("returns default icon when icon_key is null", () => {
      const result = getServiceCardStyle({ icon_key: null, color_key: "gray" });
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.gray);
    });

    it("returns default color when color_key is invalid", () => {
      const result = getServiceCardStyle({
        icon_key: "Wind",
        color_key: "invalid_key",
      });
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.slate);
    });

    it("returns correct gradient for valid color_key", () => {
      const keys: ServiceColorKey[] = [
        "sky_indigo",
        "yellow_orange",
        "cyan_blue",
        "green_teal",
        "blue_purple",
      ];
      for (const key of keys) {
        const result = getServiceCardStyle({ icon_key: "Wrench", color_key: key });
        expect(result.color).toBe(SERVICE_COLOR_KEYS[key]);
      }
    });

    it("returns correct icon for valid icon_key", () => {
      const result = getServiceCardStyle({
        icon_key: "Wind",
        color_key: "sky_indigo",
      });
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.sky_indigo);
    });

    it("trims icon_key and color_key", () => {
      const result = getServiceCardStyle({
        icon_key: "  Zap  ",
        color_key: "  green_teal  ",
      });
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.green_teal);
    });

    it("uses default icon for unknown icon_key", () => {
      const result = getServiceCardStyle({
        icon_key: "NonExistentIcon",
        color_key: "slate",
      });
      expect(result.Icon).toBeDefined();
      expect(result.color).toBe(SERVICE_COLOR_KEYS.slate);
    });

    it("uses default color when color_key is only whitespace", () => {
      const result = getServiceCardStyle({
        icon_key: "Wind",
        color_key: "   ",
      });
      expect(result.color).toBe(SERVICE_COLOR_KEYS.slate);
    });

    it("covers amber_orange and gray color keys", () => {
      expect(
        getServiceCardStyle({ icon_key: "Wrench", color_key: "amber_orange" }).color
      ).toBe(SERVICE_COLOR_KEYS.amber_orange);
      expect(getServiceCardStyle({ icon_key: "Wrench", color_key: "gray" }).color).toBe(
        SERVICE_COLOR_KEYS.gray
      );
    });
  });
});
