"use client";

import { Eraser, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cleanDemoMasterDataAction } from "@/app/(tenant)/[domain]/(authenticated)/master/import/actions";
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
import { FeatureAction } from "@/components/features/feature-action";
import { Button } from "@/components/ui/button";
import type { TenantFeatureAvailability } from "@/lib/features/tenant-feature-availability";
import { DEMO_MASTER_DATA_TYPES } from "@/lib/master-data/demo-master-data";

function DemoCleanActions() {
  const { pending } = useFormStatus();

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
      <AlertDialogAction className="w-full sm:w-auto" disabled={pending} type="submit">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
        {pending ? "Membersihkan data demo…" : "Ya, bersihkan"}
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}

export function DemoDataCleanDialog({ domain, availability }: { domain: string; availability: TenantFeatureAvailability }) {
  const action = cleanDemoMasterDataAction.bind(null, domain);

  return (
    <AlertDialog>
      <FeatureAction
        availability={availability}
        enabledTrigger={
          <AlertDialogTrigger render={<Button variant="outline" />}>
            <Eraser aria-hidden="true" />
            Bersihkan Data Demo
          </AlertDialogTrigger>
        }
        disabledTrigger={
          <Button disabled variant="outline">
            <Eraser aria-hidden="true" />
            Bersihkan Data Demo
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Eraser aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Bersihkan master data demo?</AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini akan menghapus data demo yang dibuat otomatis. Data non-demo tidak terpengaruh.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {DEMO_MASTER_DATA_TYPES.map((type) => <li key={type}>{type}</li>)}
        </ul>
        <p className="text-sm text-muted-foreground">
          Hanya baris demo (beridentitas DEMO) yang dihapus. Data lain tetap utuh.
        </p>
        <form action={action}>
          <DemoCleanActions />
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
