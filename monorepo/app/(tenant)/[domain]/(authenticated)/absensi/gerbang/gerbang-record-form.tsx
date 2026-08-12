"use client";

import { useActionState, useState, useTransition } from "react";

import { recordGerbangAction, type RecordGerbangResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type StudentOption = {
    id: string;
    nis: string;
    fullName: string;
};

export function GerbangRecordForm({
    domain,
    students,
}: {
    domain: string;
    students: StudentOption[];
}) {
    const [state, formAction, pending] = useActionState<RecordGerbangResult, FormData>(
        (_prev, formData) => recordGerbangAction(domain, formData),
        { ok: true },
    );
    const [studentId, setStudentId] = useState<string>("");
    const [isResetting, startReset] = useTransition();

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        const formData = new FormData(event.currentTarget);
        event.preventDefault();
        startReset(async () => {
            await formAction(formData);
            setStudentId("");
        });
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="studentId">Siswa</Label>
                <Select value={studentId} onValueChange={(value) => setStudentId(value ?? "")} required>
                    <SelectTrigger id="studentId" className="w-full">
                        <SelectValue placeholder="Pilih siswa" />
                    </SelectTrigger>
                    <SelectContent>
                        {students.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                                {student.fullName} ({student.nis})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <input type="hidden" name="studentId" value={studentId} />
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
                <Button type="submit" name="status" value="masuk" disabled={pending || isResetting || studentId === ""}>
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
