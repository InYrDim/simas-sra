"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateTrialDurationAction } from "./actions";

export function TrialDurationDialog({
  tenantId,
  schoolName,
  currentEndsAt,
}: {
  tenantId: string;
  schoolName: string;
  currentEndsAt: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateTrialDurationAction(tenantId, formData);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Ubah Durasi
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ubah Durasi Trial</DialogTitle>
            <DialogDescription>
              Tentukan perpanjangan atau tanggal baru untuk trial <strong>{schoolName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="additionalDays" className="text-sm font-medium">
                Tambah Berapa Hari?
              </label>
              <Input
                id="additionalDays"
                name="additionalDays"
                type="number"
                placeholder="Contoh: 14"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Dihitung dari hari ini atau dari sisa trial jika masih ada.
              </p>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">atau</span>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="newEndDate" className="text-sm font-medium">
                Tentukan Tanggal Berakhir
              </label>
              <Input
                id="newEndDate"
                name="newEndDate"
                type="date"
                defaultValue={currentEndsAt ? currentEndsAt.toISOString().split("T")[0] : ""}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
