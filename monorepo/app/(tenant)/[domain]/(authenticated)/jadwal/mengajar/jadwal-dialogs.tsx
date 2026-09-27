"use client";

import type { ReactNode } from "react";

import { ValidatedSubmitButton } from "@/components/master-data/validated-submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Shared client dialogs for the Jadwal Mengajar workspace. Server actions are
 * passed in as props from the server page so this file stays out of the
 * server-only module graph.
 */

export type JadwalDialogProps = {
  label: string;
  title: string;
  description: string;
  icon: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
  children: ReactNode;
  triggerVariant?: "outline" | "ghost" | "default";
};

function HiddenField({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

export function JadwalActionDialog({
  label,
  title,
  description,
  icon,
  action,
  hiddenFields,
  submitLabel,
  children,
  triggerVariant = "outline",
}: JadwalDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        {icon}
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <HiddenField key={name} name={name} value={value} />
          ))}
          {children}
          <ValidatedSubmitButton>{submitLabel}</ValidatedSubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function JadwalConfirmDialog({
  label,
  title,
  description,
  icon,
  action,
  hiddenFields,
}: Omit<JadwalDialogProps, "submitLabel" | "children" | "triggerVariant">) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={label} />}>{icon}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <HiddenField key={name} name={name} value={value} />
          ))}
          <ValidatedSubmitButton>Ya, lanjutkan</ValidatedSubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
