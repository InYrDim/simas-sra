import { NextResponse } from "next/server";

import { recordInboundMessage, readConnectionBySessionKey } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import { processOpenWaDelivery } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-webhook";
import { deriveOpenWaWebhookSecret, verifyOpenWaSignature } from "@/lib/integrations/whatsapp-bot/openwa-webhook-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await processOpenWaDelivery(
    {
      rawBody,
      headers: {
        signature: request.headers.get("x-openwa-signature"),
        event: request.headers.get("x-openwa-event"),
        idempotencyKey: request.headers.get("x-openwa-idempotency-key"),
      },
    },
    {
      readConnectionBySessionKey,
      deriveSecret: deriveOpenWaWebhookSecret,
      verifySignature: verifyOpenWaSignature,
      recordInboundMessage,
    },
  );

  if (result.status === "ok" || result.status === "ignored-event") {
    return NextResponse.json({ ok: true });
  }
  if (result.status === "bad-request") {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}