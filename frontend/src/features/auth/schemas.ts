import { z } from "zod";

type T = (key: "required" | "invalid_email") => string;

/** Built per render with the current locale's messages (plan: Zod schemas receive `t`). */
export function makeLoginSchema(t: T) {
  return z.object({
    email: z.string().trim().min(1, t("required")).email(t("invalid_email")),
    password: z.string().min(1, t("required")),
  });
}

export type LoginValues = z.infer<ReturnType<typeof makeLoginSchema>>;
