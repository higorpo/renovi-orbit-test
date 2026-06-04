import type { z } from "zod";
import { moderateTextContent } from "./moderateTextContent";

export function applyContentModerationZodIssue(
  ctx: z.RefinementCtx,
  value: string,
  path: (string | number)[] = [],
): void {
  const result = moderateTextContent(value);
  if (result.allowed || !result.message) return;

  ctx.addIssue({
    code: "custom",
    path,
    message: result.message,
  });
}
