import { archiveSchoolPersonAction } from "@/app/(tenant)/[domain]/(authenticated)/master/warga-sekolah/actions";
import type { SchoolPersonAggregate, SchoolProfileKind } from "@/lib/school-person-master-data";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const labels: Record<SchoolProfileKind, string> = { student: "Siswa", teacher: "Guru", staff: "Staf" };
export function SharedPersonImpact({ aggregate, current }: { aggregate: SchoolPersonAggregate; current: SchoolProfileKind }) {
  const affected = aggregate.profiles.filter((profile) => profile.kind !== current);
  if (!affected.length) return <p className="mt-2 text-sm text-muted-foreground">Perubahan ini disimpan pada Warga Sekolah yang sama.</p>;
  return <div role="note" className="mt-2 rounded-lg border p-3 text-sm"><strong>Profil lain yang ikut berubah:</strong><ul className="mt-1 list-disc pl-5">{affected.map((profile) => <li key={profile.id}>{labels[profile.kind]} ({profile.archived ? "diarsipkan" : "aktif"})</li>)}</ul><p className="mt-2">Data dan lifecycle setiap profil tetap dikelola secara terpisah.</p></div>;
}
export function SchoolPersonArchiveForm({ domain, origin, selected, aggregate }: { domain: string; origin: "siswa" | "guru" | "staf"; selected: string; aggregate: SchoolPersonAggregate }) {
  if (aggregate.person.archived) return <p role="status" className="rounded-lg border p-3">Warga Sekolah telah diarsipkan. Identifier tetap dicadangkan dan Akun Pengguna tidak diubah.</p>;
  const active = aggregate.profiles.filter((profile) => !profile.archived);
  return <Collapsible className="rounded-lg border p-4"><CollapsibleTrigger className="cursor-pointer font-medium">Arsipkan Warga Sekolah</CollapsibleTrigger><CollapsibleContent>{active.length ? <div role="status" className="mt-3 text-sm"><p>Arsip Warga Sekolah baru tersedia setelah semua profil diarsipkan.</p><ul className="mt-1 list-disc pl-5">{active.map((profile) => <li key={profile.id}>Profil {labels[profile.kind]} masih aktif</li>)}</ul></div> : <form action={archiveSchoolPersonAction.bind(null, domain)} className="mt-4 space-y-3"><input type="hidden" name="personId" value={aggregate.person.id} /><input type="hidden" name="expectedVersion" value={aggregate.person.version} /><input type="hidden" name="origin" value={origin} /><input type="hidden" name="selected" value={selected} /><p className="text-sm">Semua profil telah diarsipkan. Tindakan ini tidak mengubah atau memutus Akun Pengguna.</p><Label className="block"><span className="text-sm font-medium">Alasan</span><Textarea required name="reason" className="mt-1 min-h-24 w-full" /></Label><Button className="min-h-11 rounded-full px-4 text-primary-foreground">Arsipkan Warga Sekolah</Button></form>}</CollapsibleContent></Collapsible>;
}
