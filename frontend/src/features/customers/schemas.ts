import { z } from "zod";

type T = (key: "required" | "invalid_email" | "invalid_phone" | "max_length") => string;

/**
 * A quick pre-check for the phone field, so obvious typos fail before a round trip.
 *
 * Django has the final say (libphonenumber, default region IR, stores E.164). It accepts:
 *   09121234567, 9121234567, +989121234567, 00989121234567, "0912 123 4567", "+98 912-123-4567",
 *   Persian (۰۹۱۲…) and Arabic-Indic (٠٩١٢…) digits, and valid foreign numbers (+14155552671).
 * This check must never reject anything on that list: a stricter client blocks real users.
 *
 * It may reject what libphonenumber "repairs" instead: letters become keypad digits
 * ("0912abc4567" is saved as +989122224567) and trailing junk is dropped. Catching those here
 * stops a silently wrong number from being stored.
 */
export function isPlausiblePhone(value: string): boolean {
  // Persian (U+06F0..) and Arabic-Indic (U+0660..) digits → ASCII, so one plain pattern covers all.
  const ascii = value
    .trim()
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

  // Optional single leading "+", then digits mixed with the separators libphonenumber ignores.
  // Letters and "_" fail here (libphonenumber would turn letters into keypad digits).
  if (!/^\+?[0-9\s\-().]+$/.test(ascii)) return false;

  // E.164 allows 7-15 digits. Deliberately no Iran-specific length rule: the server owns that, and
  // a stricter client would block valid foreign numbers.
  const digits = ascii.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

/** Built per render with the current locale's messages; mirrors CustomerSerializer. */
export function makeCustomerSchema(t: T) {
  const name = z.string().trim().min(1, t("required")).max(100, t("max_length"));
  return z.object({
    first_name: name,
    last_name: name,
    email: z.string().trim().min(1, t("required")).max(254, t("max_length")).email(t("invalid_email")),
    phone: z
      .string()
      .trim()
      .min(1, t("required"))
      .max(32, t("max_length"))
      .refine(isPlausiblePhone, t("invalid_phone")),
  });
}

export type CustomerValues = z.infer<ReturnType<typeof makeCustomerSchema>>;
export type CustomerInput = z.input<ReturnType<typeof makeCustomerSchema>>;
