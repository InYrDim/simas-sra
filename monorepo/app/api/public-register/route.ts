import { NextResponse, type NextRequest } from "next/server";

import { resolveProxyRoute } from "@/lib/proxy-routing";
import { createPublicRegistration } from "@/lib/public-registration";
import { publicRegistrationStore } from "@/lib/public-registration-data";

export async function POST(request: NextRequest) {
  if (resolveProxyRoute(request.headers.get("host") ?? "", "/register", process.env.APP_DOMAIN).kind !== "next") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  try {
    const fields = body as Record<string, unknown>;
    const result = await createPublicRegistration({ store: publicRegistrationStore })({
      name: fields.name,
      email: fields.email,
      password: fields.password,
    });
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.code }, { status: 400 });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "email-unavailable" }, { status: 409 });
    throw error;
  }
}
