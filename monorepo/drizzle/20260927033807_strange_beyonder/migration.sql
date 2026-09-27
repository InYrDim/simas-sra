-- Destructive migration (wayfinder ticket 04 decision, recorded 2026-09-27): Kelas
-- sessions were previously daily; the product now ties each Kelas session to a
-- Teaching Slot. No production data exists yet, so legacy Kelas sessions and
-- their records are removed. Gerbang history is untouched.
DELETE FROM "attendance_record" WHERE "layer" = 'kelas';--> statement-breakpoint
DELETE FROM "attendance_session" WHERE "layer" = 'kelas';--> statement-breakpoint
ALTER TABLE "attendance_session" DROP CONSTRAINT "attendance_session_tenant_layer_date_unique";--> statement-breakpoint
ALTER TABLE "attendance_session" ADD COLUMN "slot_id" varchar(36);--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_tenant_slot_date_unique" UNIQUE("tenant_id","slot_id","session_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_session_tenant_gerbang_date_unique" ON "attendance_session" ("tenant_id","session_date") WHERE "layer" = 'gerbang';--> statement-breakpoint
CREATE INDEX "attendance_session_tenant_date_layer_idx" ON "attendance_session" ("tenant_id","session_date","layer");--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_tenant_slot_fkey" FOREIGN KEY ("tenant_id","slot_id") REFERENCES "teaching_slot"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_slot_layer_check" CHECK (("layer" = 'kelas' AND "slot_id" IS NOT NULL) OR ("layer" = 'gerbang' AND "slot_id" IS NULL));