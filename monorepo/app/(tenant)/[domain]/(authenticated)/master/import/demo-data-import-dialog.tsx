"use client";

import { DatabaseZap } from "lucide-react";

import { importDemoMasterDataAction } from "@/app/(tenant)/[domain]/(authenticated)/master/import/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DEMO_MASTER_DATA_TYPES } from "@/lib/demo-master-data";

export function DemoDataImportDialog({ domain }: { domain: string }) {
  const action = importDemoMasterDataAction.bind(null, domain);

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <DatabaseZap aria-hidden="true" />
        Isi Data Demo
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <DatabaseZap aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Isi master data dengan data demo?</AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini akan menambahkan data demo untuk mencoba fitur Akademik dan Pendaftaran.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {DEMO_MASTER_DATA_TYPES.map((type) => <li key={type}>{type}</li>)}
        </ul>
        <p className="text-sm text-muted-foreground">
          Data yang sudah ada tidak dihapus. Data demo dengan identitas yang sama akan diperbarui,
          bukan digandakan.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <form action={action}>
            <AlertDialogAction className="w-full" type="submit">Ya, isi data demo</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
