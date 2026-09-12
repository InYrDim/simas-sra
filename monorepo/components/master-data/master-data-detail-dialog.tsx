"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MasterDataDetailDialog({
  closeHref,
  title = "Detail data",
  description = "Informasi lengkap dan tindakan untuk data yang dipilih.",
  children,
}: {
  closeHref: string;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.push(closeHref);
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="border-b pb-4 pr-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
