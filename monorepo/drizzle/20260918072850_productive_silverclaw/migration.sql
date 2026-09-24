CREATE TABLE "people_import_audit" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"execution_id" varchar(36) NOT NULL,
	"row_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"person_id" varchar(36),
	"profile_id" varchar(36),
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_import_batch" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"source_storage_key" text NOT NULL,
	"source_byte_size" bigint NOT NULL,
	"created_by_user_id" varchar(36),
	"read_only_at" timestamp(3),
	"created_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_import_control" (
	"tenant_id" varchar(36) PRIMARY KEY,
	"emergency_stop" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_import_decision" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"revision_id" varchar(36) NOT NULL,
	"row_id" varchar(36) NOT NULL,
	"action" varchar(50) NOT NULL,
	"target_person_id" varchar(36),
	"actor_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_import_execution" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"revision_id" varchar(36) NOT NULL,
	"row_set_hash" varchar(255) NOT NULL,
	"selected_count" integer NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"completed_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "people_import_execution_row" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"execution_id" varchar(36) NOT NULL,
	"revision_id" varchar(36) NOT NULL,
	"row_id" varchar(36) NOT NULL,
	"planned_action" varchar(50),
	"target_person_id" varchar(36),
	"outcome" varchar(50),
	"error_code" varchar(50),
	"claimed_by" varchar(36),
	"claim_token" varchar(36),
	"claimed_at" timestamp(3),
	"completed_at" timestamp(3),
	"record_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "people_import_revision" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"entity_kind" varchar(50) NOT NULL,
	"template_version" varchar(50) NOT NULL,
	"row_count" integer NOT NULL,
	"parent_revision_id" varchar(36),
	"source_storage_key" text,
	"created_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_import_row" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"revision_id" varchar(36) NOT NULL,
	"row_number" integer NOT NULL,
	"state" varchar(50) NOT NULL,
	"values_json" jsonb NOT NULL,
	"findings_json" jsonb NOT NULL,
	"identity_fingerprint" varchar(255) NOT NULL,
	"candidates_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_import_success" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"revision_id" varchar(36) NOT NULL,
	"row_id" varchar(36) NOT NULL,
	"execution_id" varchar(36) NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"person_id" varchar(36),
	"profile_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "people_import_validation_job" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"status" varchar(50) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp(3),
	"claimed_at" timestamp(3),
	"claimed_by" varchar(36),
	"claim_token" varchar(36),
	"last_error_code" varchar(50),
	"completed_at" timestamp(3)
);
--> statement-breakpoint
CREATE INDEX "people_import_audit_tenant_id_idx" ON "people_import_audit" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_audit_execution_id_idx" ON "people_import_audit" ("execution_id");--> statement-breakpoint
CREATE INDEX "people_import_batch_tenant_id_idx" ON "people_import_batch" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_decision_tenant_id_idx" ON "people_import_decision" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_decision_revision_id_idx" ON "people_import_decision" ("revision_id");--> statement-breakpoint
CREATE INDEX "people_import_execution_tenant_id_idx" ON "people_import_execution" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_execution_row_tenant_id_idx" ON "people_import_execution_row" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_execution_row_execution_id_idx" ON "people_import_execution_row" ("execution_id");--> statement-breakpoint
CREATE INDEX "people_import_revision_tenant_id_idx" ON "people_import_revision" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_row_tenant_id_idx" ON "people_import_row" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_row_revision_id_idx" ON "people_import_row" ("revision_id");--> statement-breakpoint
CREATE INDEX "people_import_success_tenant_id_idx" ON "people_import_success" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_validation_job_tenant_id_idx" ON "people_import_validation_job" ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_import_validation_job_status_idx" ON "people_import_validation_job" ("status","available_at");--> statement-breakpoint
ALTER TABLE "people_import_audit" ADD CONSTRAINT "people_import_audit_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_audit" ADD CONSTRAINT "people_import_audit_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "people_import_batch" ADD CONSTRAINT "people_import_batch_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_batch" ADD CONSTRAINT "people_import_batch_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "people_import_control" ADD CONSTRAINT "people_import_control_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_decision" ADD CONSTRAINT "people_import_decision_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_decision" ADD CONSTRAINT "people_import_decision_revision_fkey" FOREIGN KEY ("revision_id") REFERENCES "people_import_revision"("id");--> statement-breakpoint
ALTER TABLE "people_import_execution" ADD CONSTRAINT "people_import_execution_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_execution" ADD CONSTRAINT "people_import_execution_batch_fkey" FOREIGN KEY ("batch_id") REFERENCES "people_import_batch"("id");--> statement-breakpoint
ALTER TABLE "people_import_execution" ADD CONSTRAINT "people_import_execution_revision_fkey" FOREIGN KEY ("revision_id") REFERENCES "people_import_revision"("id");--> statement-breakpoint
ALTER TABLE "people_import_execution_row" ADD CONSTRAINT "people_import_execution_row_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_execution_row" ADD CONSTRAINT "people_import_execution_row_execution_fkey" FOREIGN KEY ("execution_id") REFERENCES "people_import_execution"("id");--> statement-breakpoint
ALTER TABLE "people_import_revision" ADD CONSTRAINT "people_import_revision_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_revision" ADD CONSTRAINT "people_import_revision_batch_fkey" FOREIGN KEY ("batch_id") REFERENCES "people_import_batch"("id");--> statement-breakpoint
ALTER TABLE "people_import_row" ADD CONSTRAINT "people_import_row_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_row" ADD CONSTRAINT "people_import_row_revision_fkey" FOREIGN KEY ("revision_id") REFERENCES "people_import_revision"("id");--> statement-breakpoint
ALTER TABLE "people_import_success" ADD CONSTRAINT "people_import_success_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_validation_job" ADD CONSTRAINT "people_import_validation_job_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "people_import_validation_job" ADD CONSTRAINT "people_import_validation_job_batch_fkey" FOREIGN KEY ("batch_id") REFERENCES "people_import_batch"("id");