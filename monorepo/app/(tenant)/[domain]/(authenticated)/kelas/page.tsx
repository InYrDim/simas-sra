import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { db } from "@/db";
import { academicYear, classGroup, classMembership, schoolPerson, studentProfile } from "@/db/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type KelasSearchParams = { classGroupId?: string };

export default async function KelasPage({
    params,
    searchParams,
}: {
    params: Promise<{ domain: string }>;
    searchParams: Promise<KelasSearchParams>;
}) {
    const { domain } = await params;
    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "class-groups.load";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId, requestedPermissions: ["class-groups.roster.view"] });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) notFound();

    const [activeYear] = await db
        .select({ id: academicYear.id, label: academicYear.label })
        .from(academicYear)
        .where(and(eq(academicYear.tenantId, tenant.id), eq(academicYear.lifecycle, "active"), eq(academicYear.archived, false)))
        .limit(1);

    const rombelOptions = activeYear
        ? await db
            .select({ id: classGroup.id, name: classGroup.groupName })
            .from(classGroup)
            .where(and(eq(classGroup.tenantId, tenant.id), eq(classGroup.academicYearId, activeYear.id), eq(classGroup.lifecycle, "active"), eq(classGroup.archived, false)))
            .orderBy(classGroup.groupName)
        : [];

    const sp = await searchParams;
    const selectedRombel = sp.classGroupId || rombelOptions[0]?.id || "";

    const students = selectedRombel
        ? await db
            .select({ id: studentProfile.id, nis: studentProfile.nis, fullName: schoolPerson.fullName })
            .from(classMembership)
            .innerJoin(studentProfile, eq(studentProfile.id, classMembership.studentId))
            .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
            .where(and(eq(classMembership.tenantId, tenant.id), eq(classMembership.classGroupId, selectedRombel), sql`${classMembership.endedAt} IS NULL`))
            .orderBy(schoolPerson.fullName)
        : [];

    const selectedName = rombelOptions.find((r) => r.id === selectedRombel)?.name;

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-bold">Kelas</h1>
            <p className="text-muted-foreground">
                {activeYear ? `Tahun ajaran ${activeYear.label}` : "Tidak ada tahun ajaran aktif."}
            </p>

            <form action={`/${domain}/kelas`} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Rombel</span>
                    <Select name="classGroupId" defaultValue={selectedRombel} items={rombelOptions.map((rombel) => ({ value: rombel.id, label: rombel.name }))}>
                        <SelectTrigger className="h-9 w-56 bg-input/30">
                            <SelectValue placeholder="Pilih rombel" />
                        </SelectTrigger>
                        <SelectContent>
                            {rombelOptions.map((rombel) => (
                                <SelectItem key={rombel.id} value={rombel.id}>
                                    {rombel.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </label>
            </form>

            <section className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                <h2 className="text-lg font-semibold">
                    Daftar Siswa{selectedName ? ` · ${selectedName}` : ""}
                </h2>
                {students.length > 0 ? (
                    <div className="mt-3 rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>NIS</TableHead>
                                    <TableHead>Nama</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.id}>
                                        <TableCell className="font-medium">{student.nis}</TableCell>
                                        <TableCell>{student.fullName}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <p className="mt-2 text-muted-foreground">Belum ada siswa pada rombel ini.</p>
                )}
            </section>
        </div>
    );
}
