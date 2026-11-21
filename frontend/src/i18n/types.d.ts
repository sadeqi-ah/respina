import type messages from "../messages/en.json";
import type { Locale } from "./config";

// Typed message keys: t("customers.titel") is a compile error.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
