"use client";

import { FilePlus2, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { addDemoQuestionsAction } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions";
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
import { DEMO_QUIZ_QUESTIONS, DEMO_QUIZ_TOTAL_POINTS } from "@/lib/quiz/quiz-demo";

function DemoQuestionActions() {
  const { pending } = useFormStatus();

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
      <AlertDialogAction disabled={pending} type="submit">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
        {pending ? "Mengisi soal demo…" : "Ya, isi soal demo"}
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}

export function DemoQuestionsDialog({
  domain,
  sessionId,
  availability,
}: {
  domain: string;
  sessionId: string;
  availability: TenantFeatureAvailability;
}) {
  return (
    <AlertDialog>
      <FeatureAction
        availability={availability}
        enabledTrigger={
          <AlertDialogTrigger render={<Button variant="outline" />}>
            <FilePlus2 aria-hidden="true" />
            Isi Demo Soal
          </AlertDialogTrigger>
        }
        disabledTrigger={
          <Button disabled variant="outline">
            <FilePlus2 aria-hidden="true" />
            Isi Demo Soal
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <FilePlus2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Isi daftar soal dengan soal demo?</AlertDialogTitle>
          <AlertDialogDescription>
            {DEMO_QUIZ_QUESTIONS.length} soal demo dengan total {DEMO_QUIZ_TOTAL_POINTS} poin akan
            ditambahkan ke sesi draft ini.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>2 soal pilihan ganda</li>
          <li>2 soal benar/salah</li>
          <li>1 soal essay</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Soal demo yang sudah ada akan dilewati dan soal buatan Anda tidak akan dihapus.
        </p>
        <form action={addDemoQuestionsAction.bind(null, domain)}>
          <input name="sessionId" type="hidden" value={sessionId} />
          <DemoQuestionActions />
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
