"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-error";
import { applyApiError } from "@/lib/form-errors";
import { safeNext } from "@/lib/safe-next";
import { homePath } from "@/lib/session-claims";

import { meQuery } from "./queries";
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
  const queryClient = useQueryClient();
  // Signed in and on the way: the dashboard can take a while on a slow network, and the form must
  // not look ready for another try meanwhile.
  const [navigating, startNavigation] = useTransition();
  const schema = useMemo(() => makeLoginSchema(tv), [tv]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;
  const isSubmitting = form.formState.isSubmitting || navigating;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values);
      // Who signed in (the shell needs it anyway): go straight home instead of through "/", so
      // the dashboard's first frame is already the right page with the right shell.
      const me = await queryClient.fetchQuery(meQuery).catch(() => null);
      startNavigation(() => {
        router.replace(next ? safeNext(next) : me ? homePath(me) : "/");
        router.refresh();
      });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : ApiError.network(error);
      applyApiError(apiError, FIELDS, form.setError, { errors: te, validation: tv });
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
