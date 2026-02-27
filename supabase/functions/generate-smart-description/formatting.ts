import type { PromptConfig } from "./types.ts";

/**
 * Format professional_description: normalize line breaks and section spacing.
 */
export function formatProfessionalDescription(text: string): string {
  if (!text) return "";

  let formatted = text.replace(/\\n/g, "\n");

  formatted = formatted.replace(/(RESUMO DO SERVIÇO:)/g, "\n\n$1\n");
  formatted = formatted.replace(/(DESCRIÇÃO DETALHADA:)/g, "\n\n$1\n");
  formatted = formatted.replace(/(SUGESTÕES:)/g, "\n\n$1\n");
  formatted = formatted.replace(
    /([.!?])\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]{3,}:)/g,
    "$1\n\n$2"
  );
  formatted = formatted.replace(/\n{3,}/g, "\n\n");
  formatted = formatted
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  formatted = formatted.trim();

  if (!formatted.includes("RESUMO DO SERVIÇO")) {
    console.warn(
      "[formatProfessionalDescription] Required section not found in description"
    );
  }

  return formatted;
}

/**
 * Remove markdown from AI output (headings to CAPS, strip bold/code/links).
 */
export function removeMarkdown(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, (_, title) =>
    title.toUpperCase()
  );
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*(.+?)\*/g, "$1");
  cleaned = cleaned.replace(/__(.+?)__/g, "$1");
  cleaned = cleaned.replace(/_(.+?)_/g, "$1");
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`(.+?)`/g, "$1");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/^[\s]*[-*]\s+/gm, "• ");
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "• ");
  return cleaned.trim();
}

/**
 * Structure text in blocks with optional CAPS titles and block separation.
 */
export function structureInBlocks(
  text: string,
  formattingRules: PromptConfig["formatting_rules"]
): string {
  const useCaps = formattingRules.use_caps_titles !== false;
  const useBlockSeparation = formattingRules.use_block_separation !== false;

  let structured = text;

  if (useCaps) {
    structured = structured.replace(/^([A-Za-zÀ-ÿ\s]+):$/gm, (_, title) => {
      return title.toUpperCase().trim() + ":";
    });
    structured = structured.replace(
      /^([A-Z][A-Za-zÀ-ÿ\s]{2,30})(?=\n[A-Za-z])/gm,
      (match) => match.toUpperCase()
    );
  }

  if (useBlockSeparation) {
    structured = structured.replace(
      /([^\n])\n([A-ZÁÀÃÂÉÈÊÍÌÓÒÕÔÚÙÇ][A-ZÁÀÃÂÉÈÊÍÌÓÒÕÔÚÙÇ\s]+:)/g,
      "$1\n\n$2"
    );
    structured = structured.replace(/\n{3,}/g, "\n\n");
  }

  return structured.trim();
}

/**
 * Full post-processing pipeline: markdown, blocks.
 */
export function postProcessDescription(
  rawText: string,
  formattingRules: PromptConfig["formatting_rules"]
): string {
  let processed = rawText;

  if (!formattingRules.allow_markdown) {
    processed = removeMarkdown(processed);
  }
  processed = structureInBlocks(processed, formattingRules);
  processed = processed
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim();

  return processed;
}
