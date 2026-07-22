import Link from "next/link";

import { CreateQuizSessionForm } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/create/form";
import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import { createClassGroupService } from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createSubjectCatalogService } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const academicYearService = createAcademicYearService({ store: academicYearStore });
const classGroupService = createClassGroupService({ store: classGroupStore });
const subjectService = createSubjectCatalogService({ store: subjectCatalogStore });

export default async function CreateUlanganPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const principal = await enforceMasterDataAccess(domain, "write");
  const [years, groups, subjects] = await Promise.all([
    academicYearService.list(principal),
    classGroupService.list(principal),
    subjectService.list(principal),
  ]);

  const selectableYears = years.filter((y) => !y.archived).map((y) => ({ id: y.id, label: y.label }));
  const selectableGroups = groups.filter((g) => !g.archived).map((g) => ({ id: g.id, groupName: g.groupName, grade: g.grade }));
  const selectableSubjects = subjects.filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name }));

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Button nativeButton={false} render={<Link href={`/${domain}/ulangan`} />} variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Kembali
          </Button>
        </div>
        <h1 className="text-xl font-bold mt-2">Buat Sesi Ulangan Baru</h1>
        <p className="text-sm text-slate-500">Isi informasi di bawah ini untuk membuat sesi ulangan.</p>
      </header>

      <div className="p-6 max-w-2xl">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <CreateQuizSessionForm
            domain={domain}
            selectableYears={selectableYears}
            selectableSubjects={selectableSubjects}
            selectableGroups={selectableGroups}
          />
        </div>
      </div>
    </main>
  );
}
