"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive";

export function RombelFormDialog({
  title,
  description,
  triggerLabel = title,
  triggerVariant = "outline",
  children,
}: {
  title: string;
  description: string;
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant={triggerVariant} />}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent
        className="z-60 max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl"
        forceOverlay
        overlayClassName="z-60"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
