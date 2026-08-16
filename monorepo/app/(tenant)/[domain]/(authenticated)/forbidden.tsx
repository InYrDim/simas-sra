import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import { headers } from "next/headers";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { eq } from "drizzle-orm";

import { getTenantSubdomain } from "@/lib/platform/proxy-routing";
import { SignOutButton } from "@/app/access-error/sign-out-button";

type DenialKind = "trial-expired" | "suspended" | "forbidden";

async function diagnoseDenial(): Promise<DenialKind | null> {
    const host = (await headers()).get("host") ?? "";
    const domain = getTenantSubdomain(host, process.env.APP_DOMAIN);
    if (!domain) return null;

    const [row] = await db
        .select({ operationalStatus: tenant.operationalStatus, trialEndsAt: tenant.trialEndsAt })
        .from(tenant)
        .where(eq(tenant.domain, domain))
        .limit(1);
    if (!row) return null;

    if (row.trialEndsAt && row.trialEndsAt.getTime() <= Date.now()) return "trial-expired";
    if (row.operationalStatus === "suspended") return "suspended";
    return "forbidden";
}

const COPY: Record<DenialKind, { Icon: typeof Lock; title: string; body: string }> = {
    "trial-expired": {
        Icon: AlertTriangle,
        title: "Masa uji coba telah berakhir",
        body: "Akses tulis dinonaktifkan karena masa uji coba (trial) sudah habis. Data tetap dapat dilihat, tetapi perubahan belum dapat dilakukan. Hubungi Provider untuk memperpanjang langganan Anda.",
    },
    suspended: {
        Icon: ShieldAlert,
        title: "Akun ditangguhkan",
        body: "Tenant sedang dalam status ditangguhkan (suspended). Akses tulis dinonaktifkan sementara. Hubungi Provider untuk informasi lebih lanjut.",
    },
    forbidden: {
        Icon: Lock,
        title: "Akses ditolak",
        body: "Anda tidak memiliki izin untuk membuka halaman ini. Hubungi School Admin jika menurut Anda ini sebuah kesalahan.",
    },
};

export default async function TenantForbidden() {
    const kind = (await diagnoseDenial()) ?? "forbidden";
    const { Icon, title, body } = COPY[kind];

    return (
        <main className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs">
            <section
                role="alertdialog"
                aria-labelledby="tenant-forbidden-title"
                aria-describedby="tenant-forbidden-body"
                className="w-full max-w-md rounded-4xl bg-popover p-6 text-center text-popover-foreground ring-1 ring-foreground/5"
            >
                <Icon className="mx-auto size-10 text-destructive" aria-hidden />
                <h1 id="tenant-forbidden-title" className="mt-4 text-xl font-semibold">{title}</h1>
                <p id="tenant-forbidden-body" className="mt-2 text-sm text-muted-foreground">{body}</p>
                <div className="mt-6 flex justify-center">
                    <SignOutButton />
                </div>
            </section>
        </main>
    );
}
