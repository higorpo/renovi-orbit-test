import { z } from "zod";
import {
  MAX_PROPOSAL_DURATION_DAYS,
  MAX_PROPOSAL_DURATION_HOURS,
} from "@/features/negotiation-proposals/constants/proposalComposer";
import { matchesProposalDayDurationISO } from "@/features/negotiation-proposals/utils/proposalWorkingDays";
import {
  addCalendarDaysIso,
  todayCalendarIso,
} from "@/features/view-services/utils/serviceCalendarDate";
import { deriveRescheduleDateMode } from "../utils/deriveRescheduleDateMode";

export const requestRescheduleFormSchema = z.object({
  note: z.string().max(500, "A observação deve ter no máximo 500 caracteres."),
});

export type RequestRescheduleFormValues = z.infer<typeof requestRescheduleFormSchema>;

const proposeShiftSchema = z.enum(["morning", "afternoon", "full_day"]);

export const proposeRescheduleFormSchema = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
    shift: proposeShiftSchema,
    durationValueInput: z
      .string()
      .trim()
      .min(1, "Informe o tempo estimado para executar o serviço.")
      .regex(/^\d+$/, "O tempo estimado deve ser um número inteiro.")
      .refine((value) => Number.parseInt(value, 10) > 0, {
        message: "O tempo estimado deve ser maior que zero.",
      }),
    durationUnit: z.enum(["hours", "days"]),
  })
  .superRefine((data, ctx) => {
    const minDate = addCalendarDaysIso(todayCalendarIso(), 1);
    const durationValue = Number.parseInt(data.durationValueInput, 10);
    const dateMode = deriveRescheduleDateMode(data.durationUnit, durationValue);
    const startLabel = dateMode === "date_range" ? "data de início" : "data de execução";

    if (data.durationUnit === "hours" && durationValue > MAX_PROPOSAL_DURATION_HOURS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationValueInput"],
        message: "O tempo estimado não pode ser maior que 24 horas.",
      });
    }

    if (data.durationUnit === "days" && durationValue > MAX_PROPOSAL_DURATION_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationValueInput"],
        message: "O tempo estimado não pode ser maior que 1 semana (7 dias).",
      });
    }

    if (!data.startDate.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Selecione a ${startLabel}.`,
        path: ["startDate"],
      });
    } else if (data.startDate < minDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          dateMode === "date_range"
            ? "A data de início deve ser a partir de amanhã."
            : "A data de execução deve ser a partir de amanhã.",
        path: ["startDate"],
      });
    }

    if (dateMode !== "date_range") {
      return;
    }

    if (!data.endDate.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a data de fim.",
        path: ["endDate"],
      });
      return;
    }

    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de término deve ser igual ou posterior à data de início.",
        path: ["endDate"],
      });
      return;
    }

    if (!matchesProposalDayDurationISO(data.startDate, data.endDate, durationValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: `O intervalo deve ter exatamente ${durationValue} ${
          durationValue === 1 ? "dia" : "dias"
        } corridos ou ${durationValue} ${
          durationValue === 1 ? "dia útil" : "dias úteis"
        } (seg–sex).`,
      });
    }
  });

export type ProposeRescheduleFormValues = z.infer<typeof proposeRescheduleFormSchema>;
