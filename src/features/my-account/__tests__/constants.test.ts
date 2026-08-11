import { describe, it, expect } from "vitest";
import {
  profileImagePath,
  providerPortfolioImagePath,
  PROFILE_IMAGES_BUCKET,
  PROVIDER_PORTFOLIO_IMAGES_BUCKET,
  PROVIDER_PORTFOLIO_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_BYTES,
  DPO_EMAIL,
} from "../constants";

describe("profileImagePath", () => {
  it("returns path with userId and filename", () => {
    expect(profileImagePath("user-1", "avatar.jpg")).toBe(
      "users/user-1/profile/avatar.jpg"
    );
  });
});

describe("providerPortfolioImagePath", () => {
  it("returns path with providerId, itemId and filename", () => {
    expect(
      providerPortfolioImagePath("prov-1", "item-1", "photo.png")
    ).toBe("providers/prov-1/portfolio/item-1/photo.png");
  });
});

describe("constants", () => {
  it("exports expected bucket names", () => {
    expect(PROFILE_IMAGES_BUCKET).toBe("profile-images");
    expect(PROVIDER_PORTFOLIO_IMAGES_BUCKET).toBe("provider-portfolio-images");
  });

  it("exports max bytes for profile and portfolio images", () => {
    expect(PROFILE_IMAGE_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(PROVIDER_PORTFOLIO_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("exports DPO_EMAIL", () => {
    expect(DPO_EMAIL).toBe("dpo@prestway.com");
  });
});
