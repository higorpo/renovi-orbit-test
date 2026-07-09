import { z } from "zod";
import { applyContentModerationZodIssue } from "@/lib/contentModeration";
import {
  MAX_PROPOSAL_DESCRIPTION_LENGTH,
  MAX_PROPOSAL_DURATION_DAYS,
  MAX_PROPOSAL_DURATION_HOURS,
} from "../constants/proposalComposer";
import {
  countInclusiveCalendarDaysISO,
  countInclusiveWorkingDaysISO,
  matchesProposalDayDurationISO,
} from "../utils/proposalWorkingDays";
import type { ProposalComposerFormValues } from "./proposalComposer.types";

export const proposalAvailabilitySlotSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  shift: z.enum(["morning", "afternoon", "full_day"]),
});

function isValidISODate(value: string): boolean {
  if (!value) return false;
  const parsedDate = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsedDate.getTime());
}

function getTodayDateAtLocalMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function createProposalComposerSchema(
  maxDescriptionLength = MAX_PROPOSAL_DESCRIPTION_LENGTH,
) {
  return z
    .object({
      priceInput: z.string().trim().min(1, "Informe quanto você quer cobrar."),
      descriptionDraft: z
        .string()
        .trim()
        .min(1, "Descreva seu orçamento antes de enviar.")
        .max(
          maxDescriptionLength,
          `A descrição deve ter no máximo ${maxDescriptionLength} caracteres.`,
        ),
      durationValueInput: z
        .string()
        .trim()
        .min(1, "Informe o tempo estimado para executar o serviço.")
        .regex(/^\d+$/, "O tempo estimado deve ser um número inteiro.")
        .refine((value) => Number.parseInt(value, 10) > 0, {
          message: "O tempo estimado deve ser maior que zero.",
        }),
      durationUnit: z.enum(["hours", "days"]),
      availabilitySlots: z.array(proposalAvailabilitySlotSchema),
    })
    .superRefine((data, context) => {
      applyContentModerationZodIssue(context, data.descriptionDraft, ["descriptionDraft"]);

      if (data.availabilitySlots.length < 1 || data.availabilitySlots.length > 3) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["availabilitySlots"],
          message: "Informe entre 1 e 3 opções de disponibilidade.",
        });
      }

      const durationValue = Number.parseInt(data.durationValueInput, 10);

      if (data.durationUnit === "hours" && durationValue > MAX_PROPOSAL_DURATION_HOURS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationValueInput"],
          message: "O tempo estimado não pode ser maior que 24 horas.",
        });
      }

      if (data.durationUnit === "days" && durationValue < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationUnit"],
          message: "Para serviços de um único dia, use a unidade em horas.",
        });
      }

      if (data.durationUnit === "days" && durationValue > MAX_PROPOSAL_DURATION_DAYS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationValueInput"],
          message: "O tempo estimado não pode ser maior que 1 semana (7 dias).",
        });
      }

      data.availabilitySlots.forEach((slot, index) => {
        if (!slot.startDate.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["availabilitySlots", index, "startDate"],
            message: "Informe a data de início.",
          });
        } else if (!isValidISODate(slot.startDate)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["availabilitySlots", index, "startDate"],
            message: "Data de início inválida.",
          });
        } else {
          const start = new Date(`${slot.startDate}T00:00:00`);
          const today = getTodayDateAtLocalMidnight();
          if (start <= today) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["availabilitySlots", index, "startDate"],
              message: "A data de início deve ser a partir de amanhã.",
            });
          }
        }

        if (data.durationUnit === "days") {
          if (!slot.endDate.trim()) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["availabilitySlots", index, "endDate"],
              message: "Informe a data de fim para orçamentos em dias.",
            });
            return;
          }

          if (!isValidISODate(slot.endDate)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["availabilitySlots", index, "endDate"],
              message: "Data de fim inválida.",
            });
            return;
          }

          const start = new Date(`${slot.startDate}T00:00:00`);
          const end = new Date(`${slot.endDate}T00:00:00`);
          if (end < start) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["availabilitySlots", index, "endDate"],
              message: "A data final não pode ser anterior à inicial.",
            });
            return;
          }

          if (!matchesProposalDayDurationISO(slot.startDate, slot.endDate, durationValue)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["availabilitySlots", index, "endDate"],
              message: `O intervalo deve ter exatamente ${durationValue} ${
                durationValue === 1 ? "dia" : "dias"
              } corridos ou ${durationValue} ${
                durationValue === 1 ? "dia útil" : "dias úteis"
              } (seg–sex).`,
            });
          }
        }
      });
    });
}

export function validateProposalComposerForm(
  values: ProposalComposerFormValues,
  maxDescriptionLength = MAX_PROPOSAL_DESCRIPTION_LENGTH,
) {
  return createProposalComposerSchema(maxDescriptionLength).safeParse(values);
}

export function getProposalComposerFieldError(
  issues: z.ZodIssue[],
  path: Array<string | number>,
): string | null {
  const issue = issues.find((entry) => entry.path.join(".") === path.join("."));
  return issue?.message ?? null;
}

export function getInclusiveDayRangeHint(
  startDate: string,
  endDate: string,
): { message: string; isError: boolean } | null {
  if (!startDate.trim() || !endDate.trim()) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) {
    return { message: "A data final não pode ser anterior à inicial.", isError: true };
  }
  const calendarDays = countInclusiveCalendarDaysISO(startDate, endDate);
  const workingDays = countInclusiveWorkingDaysISO(startDate, endDate);
  const calendarLabel =
    calendarDays === 1 ? "1 dia corrido" : `${calendarDays} dias corridos`;
  const workingLabel = workingDays === 1 ? "1 dia útil" : `${workingDays} dias úteis`;
  return {
    message: `Intervalo: ${calendarLabel}, ${workingLabel} (início e fim inclusos)`,
    isError: false,
  };
}
