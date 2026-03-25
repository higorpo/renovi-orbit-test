import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFormById } from "../forms.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const fromMock = vi.mocked(supabase.from);

let terminalResult: { data: unknown; error: { message: string } | null } | null = null;

function makeChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(terminalResult).then(onFulfilled);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  terminalResult = null;
  fromMock.mockReturnValue(makeChain() as never);
});

describe("getFormById", () => {
  it("returns form on success", async () => {
    const form = { id: "form-1", schema: {} };
    terminalResult = { data: form, error: null };

    const result = await getFormById("form-1");
    expect(result.form).toEqual(form);
    expect(result.error).toBeNull();
  });

  it("returns null form when not found", async () => {
    terminalResult = { data: null, error: null };

    const result = await getFormById("form-missing");
    expect(result.form).toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns error on DB failure", async () => {
    terminalResult = { data: null, error: { message: "Not found" } };

    const result = await getFormById("form-1");
    expect(result.form).toBeNull();
    expect(result.error).toBe("Not found");
  });
});
