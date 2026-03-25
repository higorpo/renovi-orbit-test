import { describe, it, expect } from "vitest";
import {
  validatePasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  getPasswordStrengthDisplay,
  PASSWORD_REQUIREMENTS,
} from "../passwordPolicy";

describe("validatePasswordStrength", () => {
  it("returns valid:true for a strong password", () => {
    const result = validatePasswordStrength("MyStr0ng!Pass");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.strength).toBe(5);
  });

  it("detects missing length", () => {
    const result = validatePasswordStrength("Ab1!");
    expect(result.errors).toContain("Senha deve ter no mínimo 10 caracteres");
  });

  it("detects missing uppercase letter", () => {
    const result = validatePasswordStrength("mystr0ng!pass");
    expect(result.errors).toContain("Senha deve ter pelo menos 1 letra maiúscula");
  });

  it("detects missing lowercase letter", () => {
    const result = validatePasswordStrength("MYSTR0NG!PASS");
    expect(result.errors).toContain("Senha deve ter pelo menos 1 letra minúscula");
  });

  it("detects missing number", () => {
    const result = validatePasswordStrength("MyStrong!Pass");
    expect(result.errors).toContain("Senha deve ter pelo menos 1 número");
  });

  it("detects missing special character", () => {
    const result = validatePasswordStrength("MyStr0ngPass");
    expect(result.errors).toContain(
      "Senha deve ter pelo menos 1 caractere especial (!@#$%^&* etc.)"
    );
  });

  it("rejects common passwords", () => {
    const result = validatePasswordStrength("senha123");
    expect(result.errors).toContain("Esta senha é muito comum e não é permitida");
  });

  it("strength is capped at 5", () => {
    const result = validatePasswordStrength("MyStr0ng!PassXXX");
    expect(result.strength).toBeLessThanOrEqual(5);
  });

  it("strength is reduced for common password", () => {
    const result = validatePasswordStrength("password");
    expect(result.strength).toBeLessThanOrEqual(2);
  });

  it("returns strength 0 for empty password", () => {
    const result = validatePasswordStrength("");
    expect(result.valid).toBe(false);
    expect(result.strength).toBe(0);
  });
});

describe("getPasswordStrengthLabel", () => {
  it("returns Muito fraca for 0 and 1", () => {
    expect(getPasswordStrengthLabel(0)).toBe("Muito fraca");
    expect(getPasswordStrengthLabel(1)).toBe("Muito fraca");
  });

  it("returns Fraca for 2", () => {
    expect(getPasswordStrengthLabel(2)).toBe("Fraca");
  });

  it("returns Média for 3", () => {
    expect(getPasswordStrengthLabel(3)).toBe("Média");
  });

  it("returns Forte for 4", () => {
    expect(getPasswordStrengthLabel(4)).toBe("Forte");
  });

  it("returns Muito forte for 5", () => {
    expect(getPasswordStrengthLabel(5)).toBe("Muito forte");
  });

  it("returns Desconhecido for unknown values", () => {
    expect(getPasswordStrengthLabel(99)).toBe("Desconhecido");
  });
});

describe("getPasswordStrengthColor", () => {
  it("returns red for 0 and 1", () => {
    expect(getPasswordStrengthColor(0)).toBe("bg-red-500");
    expect(getPasswordStrengthColor(1)).toBe("bg-red-500");
  });

  it("returns orange for 2", () => {
    expect(getPasswordStrengthColor(2)).toBe("bg-orange-500");
  });

  it("returns yellow for 3", () => {
    expect(getPasswordStrengthColor(3)).toBe("bg-yellow-500");
  });

  it("returns green for 4", () => {
    expect(getPasswordStrengthColor(4)).toBe("bg-green-500");
  });

  it("returns emerald for 5", () => {
    expect(getPasswordStrengthColor(5)).toBe("bg-emerald-500");
  });

  it("returns gray for unknown values", () => {
    expect(getPasswordStrengthColor(99)).toBe("bg-gray-300");
  });
});

describe("getPasswordStrengthDisplay", () => {
  it("returns empty display for empty password", () => {
    const display = getPasswordStrengthDisplay("");
    expect(display.label).toBe("");
    expect(display.colorClass).toBe("");
    expect(display.widthPercent).toBe(0);
  });

  it("returns correct widthPercent for strength 5 (100%)", () => {
    const display = getPasswordStrengthDisplay("MyStr0ng!Pass");
    expect(display.widthPercent).toBe(100);
  });

  it("returns non-empty label and color for non-empty password", () => {
    const display = getPasswordStrengthDisplay("Ab1!XXXYYY");
    expect(display.label).not.toBe("");
    expect(display.colorClass).not.toBe("");
  });
});

describe("PASSWORD_REQUIREMENTS", () => {
  it("has 5 requirements", () => {
    expect(PASSWORD_REQUIREMENTS).toHaveLength(5);
  });

  it("each requirement has label and test function", () => {
    for (const req of PASSWORD_REQUIREMENTS) {
      expect(req.label).toBeTruthy();
      expect(typeof req.test).toBe("function");
    }
  });

  it("length requirement passes for 10+ chars", () => {
    const req = PASSWORD_REQUIREMENTS.find((r) => r.label.includes("10"));
    expect(req?.test("1234567890")).toBe(true);
    expect(req?.test("short")).toBe(false);
  });
});
