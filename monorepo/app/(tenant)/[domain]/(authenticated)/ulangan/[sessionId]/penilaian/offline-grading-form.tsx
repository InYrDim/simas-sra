"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, Save } from "lucide-react";

import {
  finalizeOfflineGradingAction,
  saveOfflineScoresAction,
  type OfflineScoreActionState,
} from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OfflineParticipant = {
  studentId: string;
  studentName: string;
  score: number | null;
  graded: boolean;
};

type ScoreDraft = Record<string, string>;
const initialState: OfflineScoreActionState = { status: "idle" };

export function OfflineGradingForm({
  domain,
  sessionId,
  maxScore,
  participants,
}: {
  domain: string;
  sessionId: string;
  maxScore: number;
  participants: OfflineParticipant[];
}) {
  const storageKey = `quiz-offline-score-draft:${domain}:${sessionId}`;
  const [draft, setDraft] = useState<ScoreDraft>({});
  const [state, saveAction, pending] = useActionState(saveOfflineScoresAction.bind(null, domain), initialState);
  const participantIds = useMemo(() => participants.map((participant) => participant.studentId), [participants]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
      const allowedIds = new Set(participantIds);
      const restored = Object.fromEntries(Object.entries(stored).filter(([studentId, value]) => allowedIds.has(studentId) && typeof value === "string"));
      queueMicrotask(() => setDraft(restored));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [participantIds, storageKey]);

  useEffect(() => {
    if (state.status !== "saved") return;
    localStorage.removeItem(storageKey);
    queueMicrotask(() => setDraft({}));
  }, [state.status, storageKey]);

  function updateScore(studentId: string, value: string) {
    setDraft((current) => {
      const next = { ...current, [studentId]: value };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  const entries = Object.entries(draft).filter(([, value]) => value !== "");
  const allGraded = participants.length > 0 && participants.every((participant) => participant.graded);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Nilai Peserta Ujian Luring</h2>
          <p className="text-sm text-slate-500">Nilai maksimum {maxScore}. Perubahan disimpan sebagai draft di perangkat ini sampai tombol Simpan Nilai ditekan.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {participants.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Tidak ada siswa Hadir atau Terlambat yang perlu dinilai.</p>
          ) : participants.map((participant, index) => (
            <div key={participant.studentId} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[3rem_1fr_12rem_8rem]">
              <span className="text-sm text-slate-500">{index + 1}</span>
              <div>
                <p className="font-medium">{participant.studentName}</p>
                <p className="text-xs text-slate-500">{participant.graded ? `Tersimpan: ${participant.score} / ${maxScore}` : "Belum dinilai"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`score-${participant.studentId}`} className="sr-only">Nilai {participant.studentName}</Label>
                <Input
                  id={`score-${participant.studentId}`}
                  type="number"
                  min={0}
                  max={maxScore}
                  step={1}
                  value={draft[participant.studentId] ?? participant.score ?? ""}
                  onChange={(event) => updateScore(participant.studentId, event.target.value)}
                  aria-label={`Nilai ${participant.studentName}`}
                />
              </div>
              <span className={participant.graded ? "text-sm font-medium text-green-600" : "text-sm text-amber-600"}>
                {participant.graded ? "Sudah dinilai" : "Belum dinilai"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {state.status === "error" ? <p role="alert" className="text-sm text-red-600">Nilai gagal disimpan: {state.code}.</p> : null}
      {state.status === "saved" ? <p role="status" className="text-sm text-green-600">Nilai berhasil disimpan.</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <form action={saveAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="studentIds" value={JSON.stringify(entries.map(([studentId]) => studentId))} />
          <input type="hidden" name="scores" value={JSON.stringify(entries.map(([, score]) => score))} />
          <Button type="submit" variant="outline" disabled={pending || entries.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {pending ? "Menyimpan..." : "Simpan Nilai"}
          </Button>
        </form>
        <form action={finalizeOfflineGradingAction.bind(null, domain)}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <Button type="submit" disabled={!allGraded}>
            <CheckCircle />
            Selesaikan Penilaian
          </Button>
        </form>
      </div>
      {!allGraded && participants.length > 0 ? <p className="text-right text-xs text-slate-500">Simpan nilai seluruh peserta sebelum menyelesaikan penilaian.</p> : null}
    </div>
  );
}
