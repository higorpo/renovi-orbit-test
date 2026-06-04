import type { ContentModerationViolation } from "./types";

const VIOLATION_MESSAGES: Record<ContentModerationViolation, string> = {
  profanity:
    "Não é permitido usar palavrões ou linguagem ofensiva. Revise o texto antes de enviar.",
  phone:
    "Não é permitido compartilhar número de telefone ou WhatsApp. Use apenas o chat da plataforma.",
};

export function getContentModerationMessage(
  violation: ContentModerationViolation,
): string {
  return VIOLATION_MESSAGES[violation];
}
