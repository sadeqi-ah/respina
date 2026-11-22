"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { Service } from "@/types/api";

import { useChangeServiceStatus } from "../queries";
import { REASON_MAX_LENGTH } from "../schemas";

type Props = { service: Service | null; onOpenChange: (open: boolean) => void };

/**
 * Confirm a suspend/activate with an optional reason. The dialog closes at once and the table
 * shows the new status immediately (optimistic); a failure rolls back and shows a toast.
 * Render it with `key={service?.id}` so every service starts with an empty reason.
 */
export function ServiceStatusToggle({ service, onOpenChange }: Props) {
  const t = useTranslations("services.statusChange");
  const ts = useTranslations("services");
  const change = useChangeServiceStatus();
  const [reason, setReason] = useState("");

  if (!service) return null;
  const target = service.status === "active" ? "suspended" : "active";
  const isSuspend = target === "suspended";

  const confirm = () => {
    // Toasts live in the hook: closing the dialog remounts this component, and TanStack drops
    // per-call mutate() callbacks once their observer unmounts.
    change.mutate({ service, status: target, reason: reason.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t(isSuspend ? "suspendTitle" : "activateTitle", { name: service.name })}</DialogTitle>
          <DialogDescription>{t(isSuspend ? "suspendDetail" : "activateDetail")}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="status-reason">{t("reason")}</FieldLabel>
          <Textarea
            id="status-reason"
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldDescription>{t("reasonHint", { max: REASON_MAX_LENGTH })}</FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ts("cancel")}
          </Button>
          {/* The confirm action is filled in both cases; shadcn's destructive variant is only a tint. */}
          <Button
            variant={isSuspend ? "destructive" : "default"}
            className={isSuspend ? "bg-destructive text-white hover:bg-destructive/85" : undefined}
            onClick={confirm}
          >
            {ts(isSuspend ? "suspend" : "activate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
