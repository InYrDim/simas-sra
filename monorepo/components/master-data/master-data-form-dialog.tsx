"use client";

import type { ReactNode } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MasterDataFormDialog({
  title,
  description = "Lengkapi data berikut, lalu simpan untuk menambahkannya ke Master Data.",
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        {title}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
