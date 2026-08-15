"use client";

import { useActionState, useState, useTransition } from "react";

import { recordGerbangAction, type RecordGerbangResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
} from "@/components/ui/combobox";

type StudentOption = {
    id: string;
    nis: string;
    fullName: string;
};

function studentLabel(student: StudentOption) {
    return `${student.fullName} (${student.nis})`;
}

export function GerbangRecordForm({
    domain,
    students,
    alreadyMasukStudentIds = [],
}: {
    domain: string;
    students: StudentOption[];
    alreadyMasukStudentIds?: string[];
}) {
    const [state, formAction, pending] = useActionState<RecordGerbangResult, FormData>(
        (_prev, formData) => recordGerbangAction(domain, formData),
        { ok: true },
    );
    const [studentId, setStudentId] = useState<string>("");
    const [isResetting, startReset] = useTransition();

    // Map student id -> option so the Combobox can render the selected name.
    const studentById = Object.fromEntries(
        students.map((student) => [student.id, student]),
    ) as Record<string, StudentOption>;
    const selectedStudent = studentId ? studentById[studentId] ?? null : null;

    // Students who already have a "masuk" record today cannot be picked again for entry.
    const alreadyMasuk = new Set(alreadyMasukStudentIds);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // Include the submitter so the clicked button's `status` (masuk/keluar) is captured.
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
                    <ComboboxValue placeholder="Pilih siswa" />
                    <ComboboxContent>
                        <ComboboxEmpty>Siswa tidak ditemukan.</ComboboxEmpty>
                        <ComboboxList>
                            {(student: StudentOption) => (
                                <ComboboxItem key={student.id} value={student}>
                                    {student.fullName} ({student.nis})
                                    {alreadyMasuk.has(student.id) ? (
                                        <span className="ml-auto text-xs text-muted-foreground">Sudah masuk</span>
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
                    placeholder="Mis. terlambat, lupa kartu"
                />
            </div>

            {!state.ok && (
                <p className="text-sm text-destructive" role="alert">
                    {state.code === "student-not-found"
                        ? "Siswa tidak ditemukan."
                        : state.code === "invalid-input"
                            ? "Pilih siswa terlebih dahulu."
                            : "Gagal mencatat. Coba lagi."}
                </p>
            )}

            <div className="flex gap-3">
                <Button type="submit" name="status" value="masuk" disabled={pending || isResetting || studentId === "" || (selectedStudent ? alreadyMasuk.has(selectedStudent.id) : false)}>
                    {pending ? <Spinner /> : null}
                    Masuk
                </Button>
                <Button type="submit" name="status" value="keluar" disabled={pending || isResetting || studentId === ""} variant="secondary">
                    {pending ? <Spinner /> : null}
                    Keluar
                </Button>
            </div>
        </form>
    );
}
