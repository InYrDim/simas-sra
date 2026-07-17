"use client";

import { authClient } from "@/lib/auth-client";
import { useParams } from "next/navigation";

export function SessionInfo() {
  const { data: session, isPending } = authClient.useSession();
  const params = useParams();
  
  if (isPending) {
    return <div className="p-4 bg-muted animate-pulse rounded-md">Memuat sesi...</div>;
  }
  
  if (!session) {
    return (
      <div className="p-4 border rounded-xl bg-destructive/10 text-destructive border-destructive/20">
        <h3 className="font-semibold mb-1">Belum Login</h3>
        <p className="text-sm">Anda belum login. Dummy UI otentikasi dapat ditambahkan di tiket berikutnya.</p>
      </div>
    );
  }

  // user.tenantId comes from auth.ts user.additionalFields
  const user = session.user as typeof session.user & { tenantId?: string }; 
  
  return (
    <div className="p-4 border rounded-xl bg-primary/10 text-primary border-primary/20">
      <h3 className="font-semibold mb-1">Informasi Sesi</h3>
      <p className="text-sm">
        Anda login sebagai <strong>{user.name}</strong> ({user.email}). 
      </p>
      <p className="text-sm mt-1">
        ID Tenant: <code className="bg-primary/20 px-1 rounded">{user.tenantId || "Tidak ada tenant"}</code>
      </p>
      <p className="text-sm mt-1 text-muted-foreground">
        Diakses melalui domain: {params.domain}
      </p>
    </div>
  );
}
