import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ApiError } from "./api-error";
import { translateError, translateFieldError } from "./translate-error";

type ErrorsT = Parameters<typeof translateError>[0];
type ValidationT = Parameters<typeof translateFieldError>[0];

/**
 * Puts an API error onto a React Hook Form form: `details.<field>` goes under that input (first
 * message only), everything else becomes the form-level `root` message. Returns the field names
 * that got an error, first one first, so the caller can move focus there.
 */
export function applyApiError<V extends FieldValues>(
  error: ApiError,
  fields: readonly Path<V>[],
  setError: UseFormSetError<V>,
  t: { errors: ErrorsT; validation: ValidationT },
): Path<V>[] {
  const hit = fields.filter((field) => error.details[field]?.length);
  for (const field of hit) {
    setError(field, { type: "server", message: translateFieldError(t.validation, error.details[field][0]) });
  }
  // Errors with no matching input (non_field_errors, 403, 409, network…) still need a message.
  setError("root", { type: "server", message: translateError(t.errors, error) });
  return hit;
}
