"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DashboardButton, dashboardButtonVariants } from "@/components/block/dashboard-shell";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-error";
import { applyApiError } from "@/lib/form-errors";

import { useCreateCustomer } from "../queries";
import { makeCustomerSchema, type CustomerInput, type CustomerValues } from "../schemas";

const FIELDS = ["first_name", "last_name", "email", "phone"] as const;

export function CustomerForm() {
  const t = useTranslations("customers.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const create = useCreateCustomer();
  const schema = useMemo(() => makeCustomerSchema(tv), [tv]);

  const form = useForm<CustomerInput, unknown, CustomerValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: "", last_name: "", email: "", phone: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const customer = await create.mutateAsync(values);
      toast.success(t("created", { name: customer.full_name }));
      router.push(`/customers/${customer.id}`);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : ApiError.network(error);
      const [first] = applyApiError(apiError, FIELDS, form.setError, { errors: te, validation: tv });
      if (first) form.setFocus(first); // e.g. a duplicate email: take the user straight to it
    }
  });

  const input = (name: (typeof FIELDS)[number]) => ({
    id: name,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    ...form.register(name),
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting} className="@container/form w-full max-w-xl">
      <FieldGroup>
        {errors.root?.message && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="grid gap-6 @md/form:grid-cols-2">
          <Field data-invalid={!!errors.first_name}>
            <FieldLabel htmlFor="first_name">{t("firstName")}</FieldLabel>
            <Input autoComplete="given-name" autoFocus {...input("first_name")} />
            <FieldError id="first_name-error" errors={[errors.first_name]} />
          </Field>
          <Field data-invalid={!!errors.last_name}>
            <FieldLabel htmlFor="last_name">{t("lastName")}</FieldLabel>
            <Input autoComplete="family-name" {...input("last_name")} />
            <FieldError id="last_name-error" errors={[errors.last_name]} />
          </Field>
        </div>

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          {/* Emails and phone numbers are always LTR, even in the fa UI. */}
          <Input type="email" dir="ltr" autoComplete="email" {...input("email")} />
          <FieldError id="email-error" errors={[errors.email]} />
        </Field>

        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
          <Input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" {...input("phone")} />
          {errors.phone ? (
            <FieldError id="phone-error" errors={[errors.phone]} />
          ) : (
            <FieldDescription>{t("phoneHint")}</FieldDescription>
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/customers" className={dashboardButtonVariants({ variant: "secondary", size: "sm" })}>
            {t("cancel")}
          </Link>
          <DashboardButton type="submit" variant="primary" size="sm" disabled={isSubmitting}>
            {isSubmitting ? t("submitting") : t("submit")}
          </DashboardButton>
        </div>
      </FieldGroup>
    </form>
  );
}
