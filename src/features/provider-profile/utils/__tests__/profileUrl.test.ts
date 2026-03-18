import { describe, it, expect } from "vitest";
import { buildProfileUrl, getProviderProfilePath } from "../profileUrl";

describe("buildProfileUrl", () => {
  it("returns path with baseUrl when provided", () => {
    expect(buildProfileUrl("joao-silva", "https://app.example.com")).toBe(
      "https://app.example.com/perfil/joao-silva"
    );
  });

  it("strips trailing slash from baseUrl", () => {
    expect(buildProfileUrl("maria", "https://x.com/")).toBe(
      "https://x.com/perfil/maria"
    );
  });

  it("encodes slug", () => {
    expect(buildProfileUrl("a b", "https://x.com")).toBe(
      "https://x.com/perfil/a%20b"
    );
  });
});

describe("getProviderProfilePath", () => {
  it("returns path with leading slash", () => {
    expect(getProviderProfilePath("joao-silva")).toBe("/perfil/joao-silva");
  });

  it("encodes slug", () => {
    expect(getProviderProfilePath("a/b")).toBe("/perfil/a%2Fb");
  });
});
