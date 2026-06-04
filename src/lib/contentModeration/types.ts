export type ContentModerationViolation = "profanity" | "phone";

export interface ContentModerationResult {
  allowed: boolean;
  violation: ContentModerationViolation | null;
  message: string | null;
}
