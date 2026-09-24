ALTER TABLE "people_import_execution_row" ALTER COLUMN "claimed_by" SET DATA TYPE varchar(100) USING "claimed_by"::varchar(100);--> statement-breakpoint
ALTER TABLE "people_import_validation_job" ALTER COLUMN "available_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "people_import_validation_job" ALTER COLUMN "available_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "people_import_validation_job" ALTER COLUMN "claimed_by" SET DATA TYPE varchar(100) USING "claimed_by"::varchar(100);--> statement-breakpoint
ALTER TABLE "people_import_validation_job" ALTER COLUMN "last_error_code" SET DATA TYPE varchar(100) USING "last_error_code"::varchar(100);--> statement-breakpoint
ALTER TABLE "people_import_audit" ADD CONSTRAINT "people_import_audit_row" UNIQUE("tenant_id","execution_id","row_id");--> statement-breakpoint
ALTER TABLE "people_import_batch" ADD CONSTRAINT "people_import_batch_storage_key_unique" UNIQUE("source_storage_key");--> statement-breakpoint
ALTER TABLE "people_import_decision" ADD CONSTRAINT "people_import_decision_row_unique" UNIQUE("tenant_id","revision_id","row_id");--> statement-breakpoint
ALTER TABLE "people_import_execution" ADD CONSTRAINT "people_import_execution_idempotency" UNIQUE("tenant_id","batch_id","revision_id","row_set_hash");--> statement-breakpoint
ALTER TABLE "people_import_execution" ADD CONSTRAINT "people_import_execution_tenant_id_id" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "people_import_execution_row" ADD CONSTRAINT "people_import_execution_selected_row" UNIQUE("tenant_id","execution_id","row_id");--> statement-breakpoint
ALTER TABLE "people_import_execution_row" ADD CONSTRAINT "people_import_execution_row_tenant_id_id" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "people_import_row" ADD CONSTRAINT "people_import_row_number_unique" UNIQUE("tenant_id","revision_id","row_number");--> statement-breakpoint
ALTER TABLE "people_import_success" ADD CONSTRAINT "people_import_success_once" UNIQUE("tenant_id","batch_id","revision_id","row_id");--> statement-breakpoint
ALTER TABLE "people_import_validation_job" ADD CONSTRAINT "people_import_job_batch_unique" UNIQUE("tenant_id","batch_id");--> statement-breakpoint
ALTER TABLE "people_import_decision" ADD CONSTRAINT "people_import_decision_row_fkey" FOREIGN KEY ("row_id") REFERENCES "people_import_row"("id");--> statement-breakpoint
ALTER TABLE "people_import_revision" ADD CONSTRAINT "people_import_revision_4u4ccRy700U6_fkey" FOREIGN KEY ("parent_revision_id") REFERENCES "people_import_revision"("id");