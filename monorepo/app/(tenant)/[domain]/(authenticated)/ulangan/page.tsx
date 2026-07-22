import Link from "next/link";

import { CreateSessionDialog } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/create-session-dialog";
import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import { createClassGroupService } from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createQuizSessionService } from "@/lib/quiz";
import { quizSessionStore } from "@/lib/quiz-data";
import { createSubjectCatalogService } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { ClipboardCheck, Monitor, PenLine } from "lucide-react";

const sessionService = createQuizSessionService({ store: quizSessionStore });
const academicYearService = createAcademicYearService({ store: academicYearStore });
const classGroupService = createClassGroupService({ store: classGroupStore });
const subjectService = createSubjectCatalogService({ store: subjectCatalogStore });

const statusLabel: Record<string, string> = {
  draft: "Draft",
  active: "Berlangsung",
  ended: "Selesai",
  graded: "Dinilai",
};

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  ended: "bg-amber-100 text-amber-700",
  graded: "bg-blue-100 text-blue-700",
};

const modeLabel: Record<string, string> = {
  daring: "Daring",
  luring: "Luring",
};

export default async function UlanganPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ domain }, raw] = await Promise.all([params, searchParams]);
  const principal = await enforceMasterDataAccess(domain, "read");
  const [sessions, years, groups, subjects] = await Promise.all([
    sessionService.list(principal),
    academicYearService.list(principal),
    classGroupService.list(principal),
    subjectService.list(principal),
  ]);

  const sorted = [...sessions]
    .filter((s) => s.status === "draft" || s.status === "active")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  function yearLabel(id: string) { return years.find((y) => y.id === id)?.label ?? id; }
  function groupLabel(id: string) { const g = groups.find((g) => g.id === id); return g ? `${g.groupName}` : id; }
  function subjectLabel(id: string) { return subjects.find((s) => s.id === id)?.name ?? id; }

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Ulangan Sederhana</h1>
          <p className="text-sm text-slate-500">Kelola sesi ulangan daring dan luring</p>
        </div>
        <CreateSessionDialog
          domain={domain}
          selectableYears={years.filter((y) => !y.archived).map((y) => ({ id: y.id, label: y.label }))}
          selectableSubjects={subjects.filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name }))}
          selectableGroups={groups.filter((g) => !g.archived).map((g) => ({ id: g.id, groupName: g.groupName, grade: g.grade }))}
        />
      </header>

      {raw.result ? (
        <p role="status" className="mx-6 mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {raw.result === "saved" ? "Sesi ulangan tersimpan." : `Operasi ditolak: ${raw.result}.`}
        </p>
      ) : null}

      <div className="p-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white py-20">
            <ClipboardCheck className="size-10 text-slate-300" />
            <p className="text-sm text-slate-500">Belum ada sesi ulangan. Klik tombol di atas untuk membuat sesi baru.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((session) => (
              <Link
                key={session.id}
                href={`/${domain}/ulangan/${session.id}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {session.title}
                  </h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[session.status]}`}>
                    {statusLabel[session.status]}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-slate-500">
                  <p className="flex items-center gap-1.5">
                    {session.mode === "daring" ? <Monitor className="size-3.5" /> : <PenLine className="size-3.5" />}
                    {modeLabel[session.mode]}
                    {session.durationMinutes ? ` • ${session.durationMinutes} menit` : ""}
                  </p>
                  <p>Tahun Ajaran: {yearLabel(session.academicYearId)}</p>
                  <p>Mapel: {subjectLabel(session.subjectId)}</p>
                  <p>Rombel: {groupLabel(session.classGroupId)}</p>
                </div>
                {session.status === "active" && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                      Sedang berlangsung
                    </p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
