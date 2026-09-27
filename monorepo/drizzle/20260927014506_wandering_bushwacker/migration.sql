CREATE TABLE "teaching_period" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"label" varchar(100) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"sort_order" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "teaching_period_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "teaching_period_tenant_label_unique" UNIQUE("tenant_id","label"),
	CONSTRAINT "teaching_period_tenant_order_unique" UNIQUE("tenant_id","sort_order"),
	CONSTRAINT "teaching_period_window_check" CHECK ("end_time" > "start_time"),
	CONSTRAINT "teaching_period_order_check" CHECK ("sort_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "teaching_slot" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"teaching_assignment_id" varchar(36) NOT NULL,
	"dayOfWeek" "schoolSchedule_day_of_week" NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"semester" "academicSemester_kind" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "teaching_slot_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "teaching_slot_window_check" CHECK ("end_time" > "start_time"),
	CONSTRAINT "teaching_slot_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE INDEX "teaching_slot_scope_idx" ON "teaching_slot" ("tenant_id","dayOfWeek","semester","start_time");--> statement-breakpoint
ALTER TABLE "teaching_period" ADD CONSTRAINT "teaching_period_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "teaching_slot" ADD CONSTRAINT "teaching_slot_assignment_fkey" FOREIGN KEY ("tenant_id","teaching_assignment_id") REFERENCES "teaching_assignment"("tenant_id","id");