import { z } from "zod";

import { SERVICE_TYPES } from "@/types/api";

type T = (key: "required" | "max_length" | "invalid_choice") => string;

/** Mirrors ServiceSerializer: name trimmed, 1–100 chars; type one of the five choices. */
export function makeServiceSchema(t: T) {
  return z.object({
    name: z.string().trim().min(1, t("required")).max(100, t("max_length")),
    service_type: z.enum(SERVICE_TYPES, { error: t("invalid_choice") }),
  });
}

export type ServiceValues = z.infer<ReturnType<typeof makeServiceSchema>>;
export type ServiceInput = z.input<ReturnType<typeof makeServiceSchema>>;

/** Mirrors StatusChangeSerializer.reason (optional, at most 500 chars). */
export const REASON_MAX_LENGTH = 500;
