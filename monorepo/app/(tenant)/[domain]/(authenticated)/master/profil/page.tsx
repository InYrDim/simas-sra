import { notFound } from "next/navigation";

import { SchoolProfileForm } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/school-profile-form";
import { SchoolProfileHistory } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/school-profile-history";
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

export default async function ProfilSekolahPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const principal = await enforceMasterDataAccess(domain, "read");
  const [result, accreditationResult] = await Promise.all([
    createGetSchoolProfileQuery({ store: schoolProfileStore })(principal),
    createListSchoolAccreditationsQuery({ store: schoolAccreditationStore })(principal),
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

    <section className="rounded-xl border bg-card p-5" aria-labelledby="provider-identity-title">
      <div className="mb-4"><h2 id="provider-identity-title" className="text-xl font-semibold">Identitas resmi Provider</h2><p className="text-sm text-muted-foreground">Data berikut hanya dapat diubah melalui pengelolaan Provider.</p></div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-sm text-muted-foreground">NPSN</dt><dd className="font-medium">{profile.provider.npsn}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Nama resmi sekolah</dt><dd className="font-medium">{profile.provider.officialName}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Jenjang pendidikan</dt><dd className="font-medium">{profile.provider.educationLevel}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Domain</dt><dd className="font-medium">{profile.provider.domain}</dd></div>
      </dl>
    </section>

    <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <div className="rounded-xl border bg-card p-5"><h2 className="mb-1 text-xl font-semibold">Informasi operasional</h2><p className="mb-6 text-sm text-muted-foreground"><span aria-hidden="true">*</span> menandai field wajib.</p><SchoolProfileForm domain={domain} version={profile.version} initial={initial} readOnly={!principal.capabilities.write} /></div>
      <aside className="space-y-4" aria-labelledby="completeness-title"><div className="rounded-xl border bg-card p-5"><h2 id="completeness-title" className="font-semibold">Kelengkapan profil</h2>
        <div className="mt-4 space-y-4"><div><h3 className="text-sm font-medium">Wajib belum lengkap</h3>{profile.completeness.requiredMissing.length ? <ul className="mt-2 list-disc pl-5 text-sm text-destructive">{profile.completeness.requiredMissing.map((field) => <li key={field}>{labels[field] ?? field}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Semua field wajib telah lengkap.</p>}</div>
        <div><h3 className="text-sm font-medium">Rekomendasi belum lengkap</h3>{profile.completeness.recommendedMissing.length ? <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{profile.completeness.recommendedMissing.map((field) => <li key={field}>{labels[field] ?? field}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Semua rekomendasi telah lengkap.</p>}</div></div></div></aside>
    </section>
    <SchoolProfileHistory domain={domain} logoAssetId={profile.logoAssetId} readOnly={!principal.capabilities.write} records={accreditationResult.records} />
  </main>;
}
