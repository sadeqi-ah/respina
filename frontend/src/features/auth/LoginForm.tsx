"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-error";
import { safeNext } from "@/lib/safe-next";
import { translateError, translateFieldError } from "@/lib/translate-error";

import { makeLoginSchema, type LoginValues } from "./schemas";

const FIELDS = ["email", "password"] as const;

async function login(values: LoginValues): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      body: JSON.stringify(values),
    });
  } catch (error) {
    throw ApiError.network(error);
  }
  if (!response.ok) throw await ApiError.fromResponse(response);
}

export function LoginForm({ next }: { next: string | null }) {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const schema = useMemo(() => makeLoginSchema(tv), [tv]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values);
      router.replace(safeNext(next));
      router.refresh();
    } catch (error) {
      const apiError = error instanceof ApiError ? error : ApiError.network(error);
      // Field errors from Django go under their inputs; everything else is a form-level message.
      for (const field of FIELDS) {
        const first = apiError.details[field]?.[0];
        if (first) form.setError(field, { message: translateFieldError(tv, first) });
      }
      form.setError("root", { message: translateError(te, apiError) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
      <FieldGroup>
        {errors.root?.message && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="username"
            autoFocus
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
