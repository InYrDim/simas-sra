import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import {
  listChatSummaries,
  listMessagesByChat,
  recordInboundMessage,
  recordOutboundMessage,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(async () => closeDatabasePool());

mysqlTest("MySQL persists outbound and inbound WhatsApp messages and derives chat summaries", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const tenantId = randomUUID();
  const ids = { actor: randomUUID(), provider: randomUUID(), binding: randomUUID(), application: randomUUID() };
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  const domain = `wa-${randomUUID()}.test.invalid`;
  const chatId = "62815551234";
  const groupChatId = "1203630000000@g.us";
  try {
    await connection.execute("INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Actor', ?, false,NOW(3),NOW(3)),(?, 'Provider', ?, false,NOW(3),NOW(3))", [ids.actor, `${ids.actor}@test.invalid`, ids.provider, `${ids.provider}@test.invalid`]);
    await connection.execute("INSERT INTO provider_admin (user_id,created_at) VALUES (?,NOW(3))", [ids.provider]);
    await connection.execute("INSERT INTO applicant_school_binding (id,user_id,canonical_npsn,created_at) VALUES (?,?,?,NOW(3))", [ids.binding, ids.actor, npsn]);
    await connection.execute("INSERT INTO simas_application (id,school_name,npsn,education_level,address,contact_name,contact_position,contact_email,contact_whatsapp,status,submitted_at,owner_user_id,binding_id,attempt_number,idempotency_key,payload_hash) VALUES (?,'WA Test',?,'SMA','A','K','O',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))", [ids.application, npsn, `${ids.application}@test.invalid`, ids.actor, ids.binding, randomUUID()]);
    await connection.execute("INSERT INTO tenant (id,name,domain,npsn,source_application_id,approved_at,operational_status,created_at,updated_at) VALUES (?, 'WA Test', ?, ?, ?, NOW(3),'active',NOW(3),NOW(3))", [tenantId, domain, npsn, ids.application]);

    await recordOutboundMessage({
      tenantId,
      openwaMessageId: "true_62815551234@c.us_A",
      idempotencyKey: "outbound:true_62815551234@c.us_A",
      event: "message.sent",
      chatId,
      fromWa: "62812000001",
      toWa: chatId,
      body: "Jadwal berubah.",
      messageType: "text",
      hasMedia: false,
      isGroup: false,
      kind: "text",
      metadata: null,
      messageTimestamp: 1706868000,
      sentAt: new Date("2026-02-03T12:00:00Z"),
      deliveryStatus: "sent",
    });
    await recordOutboundMessage({
      tenantId,
      openwaMessageId: "true_1203630000000@g.us_B",
      idempotencyKey: "outbound:true_1203630000000@g.us_B",
      event: "message.sent",
      chatId: groupChatId,
      fromWa: "62812000001",
      toWa: groupChatId,
      body: "Pengumuman kelas.",
      messageType: "text",
      hasMedia: false,
      isGroup: true,
      kind: "text",
      metadata: null,
      messageTimestamp: 1706868050,
      sentAt: new Date("2026-02-03T12:10:00Z"),
      deliveryStatus: "sent",
    });
    await recordInboundMessage({
      tenantId,
      openwaMessageId: "true_62815551234@c.us_C",
      idempotencyKey: "inbound-C",
      event: "message.received",
      direction: "inbound",
      chatId,
      fromWa: chatId,
      toWa: "62812000001",
      body: "Terima kasih.",
      messageType: "text",
      hasMedia: false,
      isGroup: false,
      kind: "text",
      metadata: null,
      messageTimestamp: 1706868100,
      receivedAt: new Date("2026-02-03T12:20:00Z"),
    });

    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT `direction`,`sent_at`,`delivery_status` FROM `whatsapp_bot_message` WHERE `tenant_id`=? ORDER BY `received_at`",
      [tenantId],
    );
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.direction),
      ["outbound", "outbound", "inbound"],
    );
    assert.ok(rows[0].sent_at instanceof Date);
    assert.equal(rows[0].delivery_status, "sent");
    assert.equal(rows[2].sent_at, null);
    assert.equal(rows[2].delivery_status, null);

    const summaries = await listChatSummaries(tenantId);
    assert.equal(summaries.length, 2);
    const chatSummary = summaries.find((summary) => summary.chatId === chatId);
    assert.ok(chatSummary);
    assert.equal(chatSummary.lastDirection, "inbound");
    assert.equal(chatSummary.lastBody, "Terima kasih.");
    assert.equal(chatSummary.lastAt.toISOString(), "2026-02-03T12:20:00.000Z");

    const history = await listMessagesByChat(tenantId, chatId);
    assert.equal(history.length, 2);
    assert.equal(history[0].direction, "inbound");
    assert.equal(history[1].direction, "outbound");

    const groupHistory = await listMessagesByChat(tenantId, groupChatId);
    assert.equal(groupHistory.length, 1);
    assert.equal(groupHistory[0].isGroup, true);
  } finally {
    await connection.execute("DELETE FROM `whatsapp_bot_message` WHERE `tenant_id`=?", [tenantId]).catch(() => undefined);
    await connection.execute("DELETE FROM `tenant` WHERE `id`=?", [tenantId]).catch(() => undefined);
    await connection.execute("DELETE FROM `simas_application` WHERE `id`=?", [ids.application]).catch(() => undefined);
    await connection.execute("DELETE FROM `applicant_school_binding` WHERE `id`=?", [ids.binding]).catch(() => undefined);
    await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [ids.provider]).catch(() => undefined);
    await connection.execute("DELETE FROM `user` WHERE `id` IN (?,?)", [ids.actor, ids.provider]).catch(() => undefined);
    await connection.end();
  }
});