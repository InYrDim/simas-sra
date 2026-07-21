import { notFound } from "next/navigation";

import { HeadmasterHistory } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/headmaster-history";
import { SchoolProfileForm } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/school-profile-form";
import { SchoolProfileHistory } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/school-profile-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createHeadmasterAssignmentService } from "@/lib/headmaster-assignment";
import { headmasterAssignmentStore } from "@/lib/headmaster-assignment-data";
import { createListSchoolAccreditationsQuery } from "@/lib/school-accreditation";
import { createGetSchoolProfileQuery } from "@/lib/school-profile";
import { schoolProfileStore } from "@/lib/school-profile-data";
import { schoolAccreditationStore } from "@/lib/school-profile-history-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const labels: Record<string, string> = {
  displayName: "Nama tampilan", "address.street": "Alamat jalan", "address.village": "Desa/Kelurahan",
  "address.district": "Kecamatan", "address.city": "Kabupaten/Kota", "address.province": "Provinsi",
  "address.postalCode": "Kode pos", institutionalEmail: "Email institusi", institutionalPhone: "Telepon institusi",
  website: "Website HTTPS", coordinates: "Koordinat", description: "Deskripsi",
};

export default async function ProfilSekolahPage({ params, searchParams }: { params: Promise<{ domain: string }>; searchParams: Promise<{ headmaster?: string }> }) {
  const [{ domain }, query] = await Promise.all([params, searchParams]);
  const principal = await enforceMasterDataAccess(domain, "read");
  const headmasterService = createHeadmasterAssignmentService({ store: headmasterAssignmentStore });
    const [result, accreditationResult, headmasterProfile, eligibleTeachers] = await Promise.all([
      createGetSchoolProfileQuery({ store: schoolProfileStore })(principal),
      createListSchoolAccreditationsQuery({ store: schoolAccreditationStore })(principal),
      headmasterService.getProfile(principal),
      headmasterService.listEligibleTeachers(principal),
    ]);
  if (!result.ok) notFound();
  const { profile } = result;
  const initial = {
    displayName: profile.displayName,
    street: profile.address.street, village: profile.address.village, district: profile.address.district,
    city: profile.address.city, province: profile.address.province, postalCode: profile.address.postalCode,
    institutionalEmail: profile.institutionalEmail ?? "", institutionalPhone: profile.institutionalPhone ?? "",
    website: profile.website ?? "", latitude: profile.latitude?.toString() ?? "", longitude: profile.longitude?.toString() ?? "",
    description: profile.description ?? "",
  };

  return <main className="space-y-8 p-4 md:p-6">
    <header><p className="text-sm font-medium text-primary">Master Data</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Profil Sekolah</h1><p className="mt-2 max-w-3xl text-muted-foreground">Identitas resmi berasal dari Provider. Lengkapi informasi operasional yang digunakan bersama di workspace sekolah.</p></header>

    <Tabs defaultValue="overview">
      <TabsList className="w-full justify-start overflow-x-auto" variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="operational">Informasi operasional</TabsTrigger>
        <TabsTrigger value="identity">Identitas</TabsTrigger>
      </TabsList>

      <TabsContent className="space-y-6 pt-4" value="overview">
        <section className="rounded-xl border bg-card p-5" aria-labelledby="completeness-title">
          <h2 id="completeness-title" className="text-xl font-semibold">Kelengkapan profil</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div><h3 className="text-sm font-medium">Wajib belum lengkap</h3>{profile.completeness.requiredMissing.length ? <ul className="mt-2 list-disc pl-5 text-sm text-destructive">{profile.completeness.requiredMissing.map((field) => <li key={field}>{labels[field] ?? field}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Semua field wajib telah lengkap.</p>}</div>
            <div><h3 className="text-sm font-medium">Rekomendasi belum lengkap</h3>{profile.completeness.recommendedMissing.length ? <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{profile.completeness.recommendedMissing.map((field) => <li key={field}>{labels[field] ?? field}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Semua rekomendasi telah lengkap.</p>}</div>
          </div>
        </section>
        <HeadmasterHistory domain={domain} current={headmasterProfile.current} history={headmasterProfile.history} teachers={eligibleTeachers} readOnly={!principal.capabilities.write} result={query.headmaster} />
      </TabsContent>

      <TabsContent className="pt-4" value="operational">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-1 text-xl font-semibold">Informasi operasional</h2>
          <p className="mb-6 text-sm text-muted-foreground"><span aria-hidden="true">*</span> menandai field wajib.</p>
          <SchoolProfileForm domain={domain} version={profile.version} initial={initial} readOnly={!principal.capabilities.write} />
        </section>
      </TabsContent>

      <TabsContent className="space-y-6 pt-4" value="identity">
        <section className="rounded-xl border bg-card p-5" aria-labelledby="provider-identity-title">
          <div className="mb-4"><h2 id="provider-identity-title" className="text-xl font-semibold">Identitas resmi Provider</h2><p className="text-sm text-muted-foreground">Data berikut hanya dapat diubah melalui pengelolaan Provider.</p></div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-sm text-muted-foreground">NPSN</dt><dd className="font-medium">{profile.provider.npsn}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Nama resmi sekolah</dt><dd className="font-medium">{profile.provider.officialName}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Jenjang pendidikan</dt><dd className="font-medium">{profile.provider.educationLevel}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Domain</dt><dd className="font-medium">{profile.provider.domain}</dd></div>
          </dl>
        </section>
        <SchoolProfileHistory domain={domain} logoAssetId={profile.logoAssetId} readOnly={!principal.capabilities.write} records={accreditationResult.records} />
      </TabsContent>
    </Tabs>
  </main>;
}
