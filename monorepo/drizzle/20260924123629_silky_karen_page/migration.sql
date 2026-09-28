CREATE TYPE "attendanceSession_source" AS ENUM('manual', 'schedule');--> statement-breakpoint
CREATE TYPE "schoolSchedule_day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TABLE "school_holiday" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "school_holiday_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "school_holiday_range_check" CHECK ("end_date" >= "start_date")
);
--> statement-breakpoint
CREATE TABLE "school_schedule_day" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"dayOfWeek" "schoolSchedule_day_of_week" NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"effective" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "school_schedule_day_tenant_dow_unique" UNIQUE("tenant_id","dayOfWeek"),
	CONSTRAINT "school_schedule_day_window_check" CHECK ("end_time" > "start_time")
);
--> statement-breakpoint
ALTER TABLE "attendance_session" ADD COLUMN "source" "attendanceSession_source" DEFAULT 'manual'::"attendanceSession_source" NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_session" ALTER COLUMN "opened_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "school_holiday" ADD CONSTRAINT "school_holiday_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "school_schedule_day" ADD CONSTRAINT "school_schedule_day_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");