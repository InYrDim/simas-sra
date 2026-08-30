"use client";

import { useActionState, useState, useTransition } from "react";

import { recordKelasAction, type RecordKelasResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, FileClock, Stethoscope, XCircle } from "lucide-react";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";

type StudentOption = {
    id: string;
    nis: string;
    fullName: string;
};

function studentLabel(student: StudentOption) {
    return `${student.fullName} (${student.nis})`;
}

export function KelasRecordForm({
    domain,
    students,
    recordedStudentIds = [],
}: {
    domain: string;
    students: StudentOption[];
    /** Students already marked present (hadir) today — cannot be marked again. */
    recordedStudentIds?: string[];
}) {
    const [state, formAction, pending] = useActionState<RecordKelasResult, FormData>(
        (_prev, formData) => recordKelasAction(domain, formData),
        { ok: true },
    );
    const [studentId, setStudentId] = useState<string>("");
    const [isResetting, startReset] = useTransition();

    const studentById = Object.fromEntries(
        students.map((student) => [student.id, student]),
    ) as Record<string, StudentOption>;
    const selectedStudent = studentId ? studentById[studentId] ?? null : null;

    const recorded = new Set(recordedStudentIds);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const submitter = (event.nativeEvent as { submitter?: HTMLElement | null }).submitter ?? undefined;
        const formData = new FormData(event.currentTarget, submitter);
        startReset(async () => {
            await formAction(formData);
            setStudentId("");
        });
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="studentId">Siswa</Label>
                <Combobox
                    id="studentId"
                    items={students}
                    value={selectedStudent}
                    itemToStringLabel={studentLabel}
                    itemToStringValue={(student) => student.id}
                    onValueChange={(student) => setStudentId(student?.id ?? "")}
                    required
                >
                    <ComboboxInput className="w-full" placeholder="Cari nama atau NIS siswa…" />
                    <ComboboxContent>
                        <ComboboxEmpty>Siswa tidak ditemukan.</ComboboxEmpty>
                        <ComboboxList>
                            {(student: StudentOption) => (
                                <ComboboxItem key={student.id} value={student}>
                                    {student.fullName} ({student.nis})
                                    {recorded.has(student.id) ? (
                                        <span className="ml-auto text-xs text-muted-foreground">Sudah hadir</span>
                                    ) : null}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
                <input type="hidden" name="studentId" value={studentId} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Catatan (opsional)</Label>
                <input
                    id="notes"
                    name="notes"
                    type="text"
                    maxLength={500}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    placeholder="Mis. terlambat, izin sakit"
                />
            </div>

            {!state.ok && (
                <p className="text-sm text-destructive" role="alert">
                    {state.code === "student-not-found"
                        ? "Siswa tidak ditemukan."
                        : state.code === "not-in-rombel"
                            ? "Siswa belum terikat rombel. Ikutkan ke rombel dulu."
                            : state.code === "invalid-input"
                                ? "Pilih siswa terlebih dahulu."
                                : "Gagal mencatat. Coba lagi."}
                </p>
            )}

            <div className="flex flex-wrap gap-3">
                <Button type="submit" name="status" value="hadir" disabled={pending || isResetting || studentId === "" || (selectedStudent ? recorded.has(selectedStudent.id) : false)}>
                    {pending ? <Spinner /> : <CheckCircle2 aria-hidden />}
                    Hadir
                </Button>
                <Button type="submit" name="status" value="izin" disabled={pending || isResetting || studentId === ""} variant="outline">
                    {pending ? <Spinner /> : <FileClock aria-hidden />}
                    Izin
                </Button>
                <Button type="submit" name="status" value="sakit" disabled={pending || isResetting || studentId === ""} variant="outline">
                    {pending ? <Spinner /> : <Stethoscope aria-hidden />}
                    Sakit
                </Button>
                <Button type="submit" name="status" value="alpa" disabled={pending || isResetting || studentId === ""} variant="secondary">
                    {pending ? <Spinner /> : <XCircle aria-hidden />}
                    Alpa
                </Button>
            </div>
        </form>
    );
}
