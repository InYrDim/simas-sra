import { notFound } from "next/navigation";

import { getPublicTenantLandingPage } from "@/lib/tenant-landing-page-data";
import { renderTenantLandingPage } from "@/lib/tenant-landing-page";
import { findPublicPpdbSession } from "@/lib/ppdb-session-data";

export default async function TenantPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const landingPage = await getPublicTenantLandingPage(domain);
  if (!landingPage) notFound();
  const ppdbSession = await findPublicPpdbSession(landingPage.id);

  const html = renderTenantLandingPage({
    html: landingPage.html,
    tenantName: landingPage.name,
    loginUrl: "/login",
    ppdbUrl: ppdbSession ? `/ppdb/${ppdbSession.id}/daftar` : "/ppdb",
  });

  return (
    <iframe
      className="fixed inset-0 size-full border-0"
      sandbox="allow-forms allow-popups allow-scripts allow-top-navigation-by-user-activation"
      srcDoc={html}
      title={`Landing page ${landingPage.name}`}
    />
  );
}
