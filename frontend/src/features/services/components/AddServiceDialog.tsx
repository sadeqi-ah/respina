"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-error";
import { applyApiError } from "@/lib/form-errors";
import { SERVICE_TYPES } from "@/types/api";

import { useCreateService } from "../queries";
import { makeServiceSchema, type ServiceInput, type ServiceValues } from "../schemas";

const FIELDS = ["name", "service_type"] as const;

type Props = {
  customerId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

export function AddServiceDialog({ customerId, open, onOpenChange, onCloseAutoFocus }: Props) {
  const t = useTranslations("services");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const create = useCreateService(customerId);
  const schema = useMemo(() => makeServiceSchema(tv), [tv]);

  const form = useForm<ServiceInput, unknown, ServiceValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", service_type: undefined },
  });
  const { errors, isSubmitting } = form.formState;

  const setOpen = (next: boolean) => {
    if (!next) form.reset(); // closing discards the draft and any errors
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const service = await create.mutateAsync(values);
      toast.success(t("add.created", { name: service.name }));
      setOpen(false);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : ApiError.network(error);
      const [first] = applyApiError(apiError, FIELDS, form.setError, { errors: te, validation: tv });
      if (first) form.setFocus(first); // e.g. a duplicate name
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("add.title")}</DialogTitle>
            <DialogDescription>{t("add.detail")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {errors.root?.message && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="service-name">{t("add.name")}</FieldLabel>
              <Input
                id="service-name"
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "service-name-error" : undefined}
                {...form.register("name")}
              />
              <FieldError id="service-name-error" errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.service_type}>
              <FieldLabel htmlFor="service-type">{t("add.type")}</FieldLabel>
              <Controller
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} name={field.name}>
                    <SelectTrigger
                      id="service-type"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={!!errors.service_type}
                      aria-describedby={errors.service_type ? "service-type-error" : undefined}
                      className="w-full"
                    >
                      <SelectValue placeholder={t("add.typePlaceholder")} />
                    </SelectTrigger>
                    {/* Below the trigger and at least as wide, flipping up when there is no room; the
                        default item-aligned mode covers the field and spills out of the dialog. */}
                    <SelectContent position="popper" align="start">
                      {SERVICE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`types.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError id="service-type-error" errors={[errors.service_type]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            {/* type="button": inside the form a plain <button> submits, which would validate first. */}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("add.submitting") : t("add.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
