import type { useTranslations } from "next-intl";

import type { ApiError } from "./api-error";

type ErrorsT = ReturnType<typeof useTranslations<"errors">>;
type ValidationT = ReturnType<typeof useTranslations<"validation">>;

/** Envelope code → translated message, falling back to the English `message` for unknown codes. */
export function translateError(t: ErrorsT, error: Pick<ApiError, "code" | "message">): string {
  return t.has(error.code as never) ? t(error.code as never) : error.message;
}

/** Field error code (`required`, `unique`, …) → translated message, with the same fallback. */
export function translateFieldError(t: ValidationT, item: { code: string; message: string }): string {
  return t.has(item.code as never) ? t(item.code as never) : item.message;
}
