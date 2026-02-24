import type { z } from "zod";

/**
 * Maps Zod validation issues to a record of field names and error messages.
 */
export function zodIssuesToFieldErrors(
  issues: z.ZodIssue[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
