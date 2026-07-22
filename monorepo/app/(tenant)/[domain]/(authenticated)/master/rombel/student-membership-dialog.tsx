"use client";

import { useActionState, useState } from "react";
import { UsersIcon } from "lucide-react";

import { addClassMembershipsAction, type AddClassMembershipsState } from "@/app/(tenant)/[domain]/(authenticated)/master/rombel/actions";
import { EffectiveDateField } from "@/app/(tenant)/[domain]/(authenticated)/master/rombel/effective-date-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


type StudentOption = Readonly<{ id: string; name: string }>;

const initialState: AddClassMembershipsState = { status: "idle" };

export function StudentMembershipDialog({
  domain,
  classGroupId,
  students,
}: {
  domain: string;
  classGroupId: string;
  students: readonly StudentOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(
    addClassMembershipsAction.bind(null, domain),
    initialState,
  );
  const selectableIds = new Set(students.map((student) => student.id));
  const selectedIds = [...selected].filter((studentId) => selectableIds.has(studentId));
  const allSelected = students.length > 0 && selectedIds.length === students.length;

  function setStudent(studentId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <UsersIcon />
        Tambah Siswa
      </DialogTrigger>
      <DialogContent
        className="z-60 max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl"
        forceOverlay
        overlayClassName="z-60"
      >
        <DialogHeader>
          <DialogTitle>Tambah Siswa ke Rombel</DialogTitle>
          <DialogDescription>
            Pilih beberapa siswa yang belum memiliki rombel. Siswa yang sudah
            memiliki rombel harus dipindahkan melalui transfer satu per satu.
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          className="space-y-4"
        >
          <input type="hidden" name="classGroupId" value={classGroupId} />
          {selectedIds.map((studentId) => (
            <input key={studentId} type="hidden" name="studentIds" value={studentId} />
          ))}
          {state.status !== "idle" ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"} role={state.status === "error" ? "alert" : "status"}>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="max-h-80 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      aria-label="Pilih semua siswa"
                      checked={allSelected}
                      disabled={students.length === 0}
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked
                            ? new Set(students.map((student) => student.id))
                            : new Set(),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Nama siswa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const checkboxId = `student-${student.id}`;
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          id={checkboxId}
                          checked={selected.has(student.id)}
                          onCheckedChange={(checked) =>
                            setStudent(student.id, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Label htmlFor={checkboxId}>{student.name}</Label>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Tidak ada siswa tanpa rombel yang dapat ditambahkan.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} siswa dipilih
          </p>
          <EffectiveDateField />

          <DialogFooter>
            <Button type="submit" disabled={selectedIds.length === 0 || pending}>
                          {pending ? "Menambahkan…" : `Tambahkan ${selectedIds.length || ""} siswa`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
