CREATE TYPE "academicOperationPreview_state" AS ENUM('pending', 'committed', 'invalidated', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "academicSemester_kind" AS ENUM('odd', 'even');--> statement-breakpoint
CREATE TYPE "academicSemester_status" AS ENUM('pending', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "academicYear_lifecycle" AS ENUM('draft', 'active', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "activityAdvisor_advisor_kind" AS ENUM('teacher', 'staff');--> statement-breakpoint
CREATE TYPE "activityGroup_lifecycle" AS ENUM('planned', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "attendanceRecord_mode" AS ENUM('manual', 'qr', 'kartu');--> statement-breakpoint
CREATE TYPE "attendanceRecord_status" AS ENUM('masuk', 'keluar', 'hadir', 'izin', 'sakit', 'alpa');--> statement-breakpoint
CREATE TYPE "attendanceSession_layer" AS ENUM('gerbang', 'kelas');--> statement-breakpoint
CREATE TYPE "attendanceSession_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "classGroup_education_level" AS ENUM('SD', 'SMP', 'SMA', 'SMK');--> statement-breakpoint
CREATE TYPE "classRelationshipEvent_kind" AS ENUM('membership', 'homeroom');--> statement-breakpoint
CREATE TYPE "classRelationshipEvent_operation" AS ENUM('opened', 'transferred', 'assigned', 'replaced');--> statement-breakpoint
CREATE TYPE "headmasterAssignmentAudit_operation" AS ENUM('assigned', 'replaced');--> statement-breakpoint
CREATE TYPE "inventoryAsset_condition" AS ENUM('good', 'damaged', 'maintenance', 'lost');--> statement-breakpoint
CREATE TYPE "inventoryAsset_tracking_mode" AS ENUM('grouped', 'individual');--> statement-breakpoint
CREATE TYPE "location_type" AS ENUM('site', 'building', 'floor', 'room', 'outdoor', 'other');--> statement-breakpoint
CREATE TYPE "organizationPeriod_status" AS ENUM('planned', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "ppdbSession_status" AS ENUM('draft', 'published', 'ended');--> statement-breakpoint
CREATE TYPE "ppdbSubmissionDocument_mime_type" AS ENUM('application/pdf', 'image/jpeg', 'image/png');--> statement-breakpoint
CREATE TYPE "ppdbSubmission_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "quizAnswerSheet_status" AS ENUM('in_progress', 'submitted', 'graded');--> statement-breakpoint
CREATE TYPE "quizAttendance_status" AS ENUM('present', 'absent', 'late');--> statement-breakpoint
CREATE TYPE "quizQuestion_question_type" AS ENUM('multiple_choice', 'true_false', 'essay');--> statement-breakpoint
CREATE TYPE "quizSession_mode" AS ENUM('daring', 'luring');--> statement-breakpoint
CREATE TYPE "quizSession_status" AS ENUM('draft', 'active', 'ended', 'graded');--> statement-breakpoint
CREATE TYPE "schoolAccreditation_rating" AS ENUM('A', 'B', 'C', 'Terakreditasi', 'Tidak Terakreditasi');--> statement-breakpoint
CREATE TYPE "schoolAdminAuthority_authority_state" AS ENUM('none', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "schoolAdminProof_kind" AS ENUM('nomination', 'recovery');--> statement-breakpoint
CREATE TYPE "schoolAdminProof_proof_state" AS ENUM('pending', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "schoolAsset_mime_type" AS ENUM('image/png', 'image/jpeg', 'image/webp');--> statement-breakpoint
CREATE TYPE "schoolPersonAudit_operation" AS ENUM('archived');--> statement-breakpoint
CREATE TYPE "schoolPerson_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "securityAuditEvent_actor_kind" AS ENUM('tenant-user', 'provider-admin', 'system', 'support-recovery');--> statement-breakpoint
CREATE TYPE "securityAuditEvent_outcome" AS ENUM('succeeded', 'annotated');--> statement-breakpoint
CREATE TYPE "securityAuditLegalHold_state" AS ENUM('active', 'released');--> statement-breakpoint
CREATE TYPE "securityCommand_security_context_kind" AS ENUM('tenant', 'provider');--> statement-breakpoint
CREATE TYPE "securityCommand_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "securityMigrationCheckpoint_state" AS ENUM('pending', 'running', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "securityReconciliationFinding_severity" AS ENUM('warning', 'blocking');--> statement-breakpoint
CREATE TYPE "securityReconciliationFinding_state" AS ENUM('open', 'resolved', 'accepted');--> statement-breakpoint
CREATE TYPE "simasApplication_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "staffAudit_operation" AS ENUM('created-person', 'created-staff', 'attached-staff', 'edited', 'status-transitioned', 'service-corrected', 'archive-denied', 'archived', 'reactivated');--> statement-breakpoint
CREATE TYPE "staffProfile_employment_type" AS ENUM('civil-servant', 'government-contract', 'foundation-permanent', 'foundation-contract', 'honorary', 'other');--> statement-breakpoint
CREATE TYPE "staffProfile_position" AS ENUM('administration', 'finance', 'library', 'laboratory', 'security', 'cleaning', 'other');--> statement-breakpoint
CREATE TYPE "studentAudit_operation" AS ENUM('created-person', 'created-student', 'attached-student', 'edited', 'status-transitioned', 'graduation-corrected', 'archive-denied', 'archived', 'reactivated');--> statement-breakpoint
CREATE TYPE "studentProfile_status" AS ENUM('active', 'graduated', 'transferred', 'withdrawn');--> statement-breakpoint
CREATE TYPE "subjectHistory_operation" AS ENUM('created', 'edited', 'archived', 'reactivated');--> statement-breakpoint
CREATE TYPE "teacherAudit_operation" AS ENUM('created-person', 'created-teacher', 'attached-teacher', 'edited', 'status-transitioned', 'service-corrected', 'archive-denied', 'archived', 'reactivated');--> statement-breakpoint
CREATE TYPE "teacherProfile_employment_type" AS ENUM('civil-servant', 'government-contract', 'foundation-permanent', 'foundation-contract', 'honorary');--> statement-breakpoint
CREATE TYPE "teacherProfile_status" AS ENUM('active', 'leave', 'ended');--> statement-breakpoint
CREATE TYPE "teachingAssignmentEvent_operation" AS ENUM('created', 'planned-updated', 'activated', 'ended', 'cancelled', 'replaced');--> statement-breakpoint
CREATE TYPE "teachingAssignment_status" AS ENUM('planned', 'active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "tenantAccountLifecycleCase_delivery_channel" AS ENUM('email', 'temporary-credential');--> statement-breakpoint
CREATE TYPE "tenantAccountLifecycleCase_kind" AS ENUM('activation', 'recovery');--> statement-breakpoint
CREATE TYPE "tenantAccountLifecycleCase_state" AS ENUM('pending', 'completed', 'expired', 'cancelled', 'revoked');--> statement-breakpoint
CREATE TYPE "tenantAccountSecurity_lifecycle" AS ENUM('pending-activation', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "tenant_operational_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "tenantRbacRollout_http_mode" AS ENUM('legacy', 'intersection', 'rbac', 'rbac-emergency');--> statement-breakpoint
CREATE TYPE "tenant_reconciliation_status" AS ENUM('not_required', 'needs_reconciliation');--> statement-breakpoint
CREATE TYPE "tenantRoleAssignment_state" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "tenantRole_legacy_role" AS ENUM('pimpinan', 'staff', 'guru', 'siswa', 'guest');--> statement-breakpoint
CREATE TYPE "tenantRole_lifecycle" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "tenantRole_migration_verification" AS ENUM('pending', 'verified', 'mismatch');--> statement-breakpoint
CREATE TYPE "tenantRole_origin" AS ENUM('scratch', 'template', 'copy', 'legacy-migration');--> statement-breakpoint
CREATE TYPE "user_tenant_role" AS ENUM('school-admin', 'pimpinan', 'staff', 'guru', 'siswa', 'guest');--> statement-breakpoint
CREATE TYPE "whatsappBotConnection_status" AS ENUM('connected', 'error');--> statement-breakpoint
CREATE TYPE "whatsappBotMessage_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "whatsappBotRequest_resolution_method" AS ENUM('self_service', 'provider');--> statement-breakpoint
CREATE TYPE "whatsapp_bot_request_status" AS ENUM('pending', 'approved', 'fulfilled', 'rejected');--> statement-breakpoint
CREATE TABLE "academic_operation_preview" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation_id" varchar(128) NOT NULL,
	"token_digest" varchar(64) NOT NULL CONSTRAINT "academic_preview_token_digest_unique" UNIQUE,
	"intent_digest" varchar(64) NOT NULL,
	"normalized_intent" jsonb NOT NULL,
	"state" "academicOperationPreview_state" DEFAULT 'pending'::"academicOperationPreview_state" NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"idempotency_key" varchar(128),
	"outcome" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"committed_at" timestamp(3),
	"invalidated_at" timestamp(3),
	CONSTRAINT "academic_preview_actor_idempotency_unique" UNIQUE("tenant_id","actor_user_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "academic_semester" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"kind" "academicSemester_kind" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "academicSemester_status" DEFAULT 'pending'::"academicSemester_status" NOT NULL,
	"active_slot" varchar(36) GENERATED ALWAYS AS (CASE WHEN status = 'active' THEN tenant_id ELSE NULL END) STORED CONSTRAINT "academic_semester_active_slot_unique" UNIQUE,
	CONSTRAINT "academic_semester_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "academic_semester_year_kind_unique" UNIQUE("academic_year_id","kind"),
	CONSTRAINT "academic_semester_period_check" CHECK ("start_date" <= "end_date")
);
--> statement-breakpoint
CREATE TABLE "academic_year" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"label" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"lifecycle" "academicYear_lifecycle" DEFAULT 'draft'::"academicYear_lifecycle" NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"active_slot" varchar(36) GENERATED ALWAYS AS (CASE WHEN lifecycle = 'active' AND archived = false THEN tenant_id ELSE NULL END) STORED CONSTRAINT "academic_year_active_slot_unique" UNIQUE,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "academic_year_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "academic_year_tenant_label_unique" UNIQUE("tenant_id","label"),
	CONSTRAINT "academic_year_period_check" CHECK ("start_date" < "end_date"),
	CONSTRAINT "academic_year_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "academic_year_history" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"effective_date" date NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	"fromLifecycle" "academicYear_lifecycle",
	"toLifecycle" "academicYear_lifecycle" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" varchar(36) PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp(3),
	"refresh_token_expires_at" timestamp(3),
	"scope" text,
	"password" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_advisor" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"advisorKind" "activityAdvisor_advisor_kind" NOT NULL,
	"advisor_id" varchar(36) NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(1000) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "activity_advisor_range_check" CHECK ("ended_at" IS NULL OR "ended_at">="started_at")
);
--> statement-breakpoint
CREATE TABLE "activity_event" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"extracurricular_id" varchar(36) NOT NULL,
	"group_id" varchar(36),
	"relationship_id" varchar(36),
	"actor_user_id" varchar(36) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"effective_date" date,
	"reason" varchar(1000) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_group" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"extracurricular_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"name" varchar(150) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"capacity" integer NOT NULL,
	"location_id" varchar(36),
	"schedule_text" varchar(500) NOT NULL,
	"lifecycle" "activityGroup_lifecycle" DEFAULT 'planned'::"activityGroup_lifecycle" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "activity_group_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "activity_group_range_check" CHECK ("end_date">="start_date"),
	CONSTRAINT "activity_group_capacity_check" CHECK ("capacity">0)
);
--> statement-breakpoint
CREATE TABLE "activity_participant" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(1000) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "activity_participant_range_check" CHECK ("ended_at" IS NULL OR "ended_at">="started_at")
);
--> statement-breakpoint
CREATE TABLE "applicant" (
	"user_id" varchar(36) PRIMARY KEY,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_school_binding" (
	"id" varchar(36) PRIMARY KEY,
	"user_id" varchar(36) NOT NULL CONSTRAINT "applicant_school_binding_user_id_unique" UNIQUE,
	"canonical_npsn" varchar(8) NOT NULL CONSTRAINT "applicant_school_binding_canonical_npsn_unique" UNIQUE,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_record" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"session_id" varchar(36),
	"layer" "attendanceSession_layer" NOT NULL,
	"mode" "attendanceRecord_mode" NOT NULL,
	"recorded_at" timestamp(3) NOT NULL,
	"status" "attendanceRecord_status" NOT NULL,
	"recorded_by_user_id" varchar(36) NOT NULL,
	"out_of_session" boolean DEFAULT false NOT NULL,
	"notes" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "attendance_record_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "attendance_record_version_check" CHECK ("version" > 0),
	CONSTRAINT "attendance_record_layer_status_check" CHECK ((
        ("layer" = 'gerbang' AND "status" IN ('masuk', 'keluar', 'izin', 'sakit'))
        OR ("layer" = 'kelas' AND "status" IN ('hadir', 'izin', 'sakit', 'alpa'))
      ))
);
--> statement-breakpoint
CREATE TABLE "attendance_session" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"layer" "attendanceSession_layer" NOT NULL,
	"session_date" date NOT NULL,
	"planned_start" time(0) NOT NULL,
	"planned_end" time(0) NOT NULL,
	"opened_at" timestamp(3) NOT NULL,
	"closed_at" timestamp(3),
	"opened_by_user_id" varchar(36) NOT NULL,
	"status" "attendanceSession_status" NOT NULL,
	"notes" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "attendance_session_tenant_layer_date_unique" UNIQUE("tenant_id","layer","session_date"),
	CONSTRAINT "attendance_session_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "attendance_session_version_check" CHECK ("version" > 0),
	CONSTRAINT "attendance_session_window_check" CHECK ("planned_end" > "planned_start")
);
--> statement-breakpoint
CREATE TABLE "class_group" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"educationLevel" "classGroup_education_level" NOT NULL,
	"grade" integer NOT NULL,
	"group_name" varchar(100) NOT NULL,
	"normalized_group_name" varchar(100) NOT NULL,
	"code" varchar(30),
	"normalized_code" varchar(30),
	"capacity" integer,
	"primary_location_id" varchar(36),
	"lifecycle" "academicYear_lifecycle" DEFAULT 'draft'::"academicYear_lifecycle" NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(1000),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "class_group_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "class_group_tenant_id_year_unique" UNIQUE("tenant_id","id","academic_year_id"),
	CONSTRAINT "class_group_year_name_unique" UNIQUE("tenant_id","academic_year_id","normalized_group_name"),
	CONSTRAINT "class_group_tenant_code_unique" UNIQUE("tenant_id","normalized_code"),
	CONSTRAINT "class_group_grade_check" CHECK ("grade" BETWEEN 1 AND 12),
	CONSTRAINT "class_group_capacity_check" CHECK ("capacity" IS NULL OR ("capacity" BETWEEN 1 AND 999)),
	CONSTRAINT "class_group_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "class_group_history" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"class_group_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	CONSTRAINT "class_group_history_version_check" CHECK ("from_version" >= 0 AND "to_version" = "from_version" + 1)
);
--> statement-breakpoint
CREATE TABLE "class_group_relationship" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"class_group_id" varchar(36) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_membership" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"class_group_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"planned" boolean NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(1000) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"active_student_slot" varchar(36) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL AND planned = false THEN student_id ELSE NULL END) STORED,
	"planned_student_slot" varchar(36) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL AND planned = true THEN student_id ELSE NULL END) STORED,
	CONSTRAINT "class_membership_open_active_unique" UNIQUE("tenant_id","active_student_slot"),
	CONSTRAINT "class_membership_open_planned_unique" UNIQUE("tenant_id","planned_student_slot"),
	CONSTRAINT "class_membership_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "class_relationship_event" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"kind" "classRelationshipEvent_kind" NOT NULL,
	"relationship_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "classRelationshipEvent_operation" NOT NULL,
	"effective_date" date NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracurricular" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(150) NOT NULL,
	"normalized_name" varchar(150) NOT NULL,
	"code" varchar(30) NOT NULL,
	"normalized_code" varchar(30) NOT NULL,
	"description" text,
	"default_location_id" varchar(36),
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(1000),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "extracurricular_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "extracurricular_tenant_code_unique" UNIQUE("tenant_id","normalized_code"),
	CONSTRAINT "extracurricular_version_check" CHECK ("version">0)
);
--> statement-breakpoint
CREATE TABLE "headmaster_assignment" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"teacher_id" varchar(36) NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(1000) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"open_slot" varchar(7) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN 'current' ELSE NULL END) STORED,
	CONSTRAINT "headmaster_assignment_open_unique" UNIQUE("tenant_id","open_slot"),
	CONSTRAINT "headmaster_assignment_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "headmaster_assignment_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "headmaster_assignment_audit" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"assignment_id" varchar(36) NOT NULL,
	"previous_assignment_id" varchar(36),
	"teacher_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "headmasterAssignmentAudit_operation" NOT NULL,
	"effective_date" date NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homeroom_assignment" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"teacher_id" varchar(36) NOT NULL,
	"class_group_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(1000) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"open_group_slot" varchar(36) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN class_group_id ELSE NULL END) STORED,
	"open_teacher_year_slot" varchar(73) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN teacher_id || ':' || academic_year_id ELSE NULL END) STORED,
	CONSTRAINT "homeroom_open_group_unique" UNIQUE("tenant_id","open_group_slot"),
	CONSTRAINT "homeroom_open_teacher_year_unique" UNIQUE("tenant_id","open_teacher_year_slot"),
	CONSTRAINT "homeroom_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "inventory_asset" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"inventory_code" varchar(50) NOT NULL,
	"normalized_inventory_code" varchar(50) NOT NULL,
	"name" varchar(150) NOT NULL,
	"normalized_name" varchar(150) NOT NULL,
	"category" varchar(100) NOT NULL,
	"trackingMode" "inventoryAsset_tracking_mode" NOT NULL,
	"condition" "inventoryAsset_condition" NOT NULL,
	"quantity" integer NOT NULL,
	"location_id" varchar(36),
	"acquisition_date" date,
	"acquisition_cost" integer,
	"acquisition_source" varchar(150),
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(1000),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "inventory_asset_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "inventory_asset_tenant_code_unique" UNIQUE("tenant_id","normalized_inventory_code"),
	CONSTRAINT "inventory_asset_quantity_check" CHECK ("quantity" >= 0 AND ("trackingMode" = 'grouped' OR "quantity" = 1)),
	CONSTRAINT "inventory_asset_cost_check" CHECK ("acquisition_cost" IS NULL OR "acquisition_cost" >= 0),
	CONSTRAINT "inventory_asset_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_asset_history" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"asset_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	CONSTRAINT "inventory_history_version_check" CHECK ("from_version" >= 0 AND "to_version" = "from_version" + 1)
);
--> statement-breakpoint
CREATE TABLE "inventory_asset_reference" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"asset_id" varchar(36) NOT NULL,
	"label" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(150) NOT NULL,
	"normalized_name" varchar(150) NOT NULL,
	"code" varchar(30) NOT NULL,
	"normalized_code" varchar(30) NOT NULL,
	"type" "location_type" NOT NULL,
	"capacity" integer,
	"description" text,
	"parent_id" varchar(36),
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(1000),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "location_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "location_tenant_code_unique" UNIQUE("tenant_id","normalized_code"),
	CONSTRAINT "location_capacity_check" CHECK ("capacity" IS NULL OR ("capacity" BETWEEN 1 AND 100000)),
	CONSTRAINT "location_version_check" CHECK ("version" > 0),
	CONSTRAINT "location_not_self_parent_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);
--> statement-breakpoint
CREATE TABLE "location_history" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"location_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	CONSTRAINT "location_history_version_check" CHECK ("from_version" >= 0 AND "to_version" = "from_version" + 1)
);
--> statement-breakpoint
CREATE TABLE "location_reference" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"location_id" varchar(36) NOT NULL,
	"label" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_event" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"period_id" varchar(36),
	"relationship_id" varchar(36),
	"actor_user_id" varchar(36) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"effective_date" date,
	"reason" varchar(1000) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_leadership" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"period_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"position_name" varchar(100) NOT NULL,
	"normalized_position_name" varchar(100) NOT NULL,
	"allows_multiple_holders" boolean NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(1000) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "organization_leadership_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "organization_membership" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(1000) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "organization_membership_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "organization_period" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" "organizationPeriod_status" DEFAULT 'planned'::"organizationPeriod_status" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "organization_period_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "organization_period_range_check" CHECK ("end_date" >= "start_date")
);
--> statement-breakpoint
CREATE TABLE "ppdb_session" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"end_date" date NOT NULL,
	"status" "ppdbSession_status" DEFAULT 'draft'::"ppdbSession_status" NOT NULL,
	"fields" jsonb,
	"draft_fields" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp(3),
	"ended_at" timestamp(3),
	"accepted_feedback" text,
	"accepted_next_steps" text,
	"rejected_feedback" text,
	"rejected_next_steps" text,
	"whatsapp_group_url" varchar(2048),
	"results_published_at" timestamp(3),
	"result_check_closed_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"published_slot" varchar(36) GENERATED ALWAYS AS (CASE WHEN status = 'published' THEN tenant_id ELSE NULL END) STORED CONSTRAINT "ppdb_session_published_slot_unique" UNIQUE,
	CONSTRAINT "ppdb_session_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "ppdb_session_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "ppdb_submission" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"registration_code" varchar(20) NOT NULL,
	"student_name" varchar(255) NOT NULL,
	"nisn" varchar(20) NOT NULL,
	"status" "ppdbSubmission_status" DEFAULT 'pending'::"ppdbSubmission_status" NOT NULL,
	"score" integer,
	"form_fields" jsonb,
	"form_data" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "ppdb_submission_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "ppdb_submission_tenant_registration_code_unique" UNIQUE("tenant_id","registration_code"),
	CONSTRAINT "ppdb_submission_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "ppdb_submission_document" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"submission_id" varchar(36) NOT NULL,
	"field_id" varchar(100) NOT NULL,
	"storage_key" varchar(700) NOT NULL CONSTRAINT "ppdb_submission_document_storage_key_unique" UNIQUE,
	"original_file_name" varchar(255) NOT NULL,
	"mimeType" "ppdbSubmissionDocument_mime_type" NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "ppdb_submission_document_field_unique" UNIQUE("tenant_id","submission_id","field_id"),
	CONSTRAINT "ppdb_submission_document_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 2097152)
);
--> statement-breakpoint
CREATE TABLE "provider_admin" (
	"user_id" varchar(36) PRIMARY KEY,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_settings" (
	"id" integer PRIMARY KEY,
	"default_trial_days" integer DEFAULT 31 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answer" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"answer_sheet_id" varchar(36) NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"answer_text" varchar(500),
	"is_correct" boolean,
	"score" integer,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answer_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "quiz_answer_sheet_question_unique" UNIQUE("tenant_id","answer_sheet_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_answer_sheet" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"status" "quizAnswerSheet_status" DEFAULT 'in_progress'::"quizAnswerSheet_status" NOT NULL,
	"total_score" integer,
	"max_score" integer,
	"submitted_at" timestamp(3),
	"graded_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answer_sheet_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "quiz_answer_sheet_tenant_session_student_unique" UNIQUE("tenant_id","session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_attendance" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"status" "quizAttendance_status" NOT NULL,
	"notes" varchar(500),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attendance_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "quiz_attendance_tenant_session_student_unique" UNIQUE("tenant_id","session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_question" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"question_text" text NOT NULL,
	"questionType" "quizQuestion_question_type" NOT NULL,
	"options" jsonb,
	"correct_answer" varchar(500),
	"points" integer DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_question_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "quiz_question_points_check" CHECK ("points" > 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_session" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"subject_id" varchar(36) NOT NULL,
	"class_group_id" varchar(36) NOT NULL,
	"mode" "quizSession_mode" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "quizSession_status" DEFAULT 'draft'::"quizSession_status" NOT NULL,
	"duration_minutes" integer,
	"started_at" timestamp(3),
	"ended_at" timestamp(3),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_session_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "quiz_session_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "school_accreditation" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"profile_id" varchar(36) NOT NULL,
	"rating" "schoolAccreditation_rating" NOT NULL,
	"certificate_number" varchar(100) NOT NULL,
	"issuing_institution" varchar(150) NOT NULL,
	"determination_date" varchar(10) NOT NULL,
	"expiry_date" varchar(10),
	"supersedes_id" varchar(36),
	"correction_id" varchar(36),
	"invalidation_reason" varchar(500),
	"invalidated_at" timestamp(3),
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "school_accreditation_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "school_accreditation_period_check" CHECK ("expiry_date" IS NULL OR "expiry_date" >= "determination_date")
);
--> statement-breakpoint
CREATE TABLE "school_admin_authority" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"authorityState" "schoolAdminAuthority_authority_state" DEFAULT 'none'::"schoolAdminAuthority_authority_state" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"granted_at" timestamp(3),
	"disabled_at" timestamp(3),
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "school_admin_authority_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "school_admin_authority_tenant_user_unique" UNIQUE("tenant_id","user_id"),
	CONSTRAINT "school_admin_authority_version_check" CHECK ("version" > 0),
	CONSTRAINT "school_admin_authority_state_check" CHECK ((
      ("authorityState" = 'none' AND "granted_at" IS NULL AND "disabled_at" IS NULL)
      OR ("authorityState" = 'active' AND "granted_at" IS NOT NULL AND "disabled_at" IS NULL)
      OR ("authorityState" = 'disabled' AND "granted_at" IS NOT NULL AND "disabled_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "school_admin_proof" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"authority_id" varchar(36) NOT NULL,
	"case_id" varchar(36) NOT NULL,
	"kind" "schoolAdminProof_kind" NOT NULL,
	"proofState" "schoolAdminProof_proof_state" DEFAULT 'pending'::"schoolAdminProof_proof_state" NOT NULL,
	"secret_digest" varchar(128),
	"expires_at" timestamp(3),
	"completed_at" timestamp(3),
	"pending_slot" boolean GENERATED ALWAYS AS (CASE WHEN "proofState" = 'pending' THEN true ELSE NULL END) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "school_admin_proof_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "school_admin_proof_case_unique" UNIQUE("tenant_id","case_id"),
	CONSTRAINT "school_admin_proof_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "school_admin_proof_pending_unique" UNIQUE("tenant_id","authority_id","kind","pending_slot"),
	CONSTRAINT "school_admin_proof_version_check" CHECK ("version" > 0),
	CONSTRAINT "school_admin_proof_pending_check" CHECK (("proofState" <> 'pending') OR ("secret_digest" IS NOT NULL AND "expires_at" IS NOT NULL AND "completed_at" IS NULL)),
	CONSTRAINT "school_admin_proof_completed_check" CHECK (("proofState" <> 'completed') OR "completed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "school_asset" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"storage_key" varchar(700) NOT NULL CONSTRAINT "school_asset_storage_key_unique" UNIQUE,
	"mimeType" "schoolAsset_mime_type" NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "school_asset_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "school_asset_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 2097152),
	CONSTRAINT "school_asset_dimensions_check" CHECK ("width" >= 256 AND "height" >= 256 AND "width" = "height")
);
--> statement-breakpoint
CREATE TABLE "school_person" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"normalized_name" varchar(150) NOT NULL,
	"preferred_name" varchar(150),
	"birth_place" varchar(100) NOT NULL,
	"normalized_birth_place" varchar(100) NOT NULL,
	"birth_date" date NOT NULL,
	"gender" "schoolPerson_gender" NOT NULL,
	"nik" varchar(16),
	"nip" varchar(18),
	"religion" varchar(50),
	"street" varchar(255) NOT NULL,
	"village" varchar(100),
	"district" varchar(100),
	"city" varchar(100),
	"province" varchar(100),
	"postal_code" varchar(10),
	"phone" varchar(20),
	"email" varchar(255),
	"account_user_id" varchar(36),
	"archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "school_person_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "school_person_tenant_nik_unique" UNIQUE("tenant_id","nik"),
	CONSTRAINT "school_person_tenant_nip_unique" UNIQUE("tenant_id","nip"),
	CONSTRAINT "school_person_tenant_account_unique" UNIQUE("tenant_id","account_user_id"),
	CONSTRAINT "school_person_nik_check" CHECK ("nik" IS NULL OR "nik" ~ '^[0-9]{16}$'),
	CONSTRAINT "school_person_nip_check" CHECK ("nip" IS NULL OR "nip" ~ '^[0-9]{18}$'),
	CONSTRAINT "school_person_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "school_person_audit" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"person_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "schoolPersonAudit_operation" NOT NULL,
	"affected_profiles" jsonb NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"sensitive_before" jsonb,
	"sensitive_after" jsonb,
	"reason" varchar(1000),
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_profile" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL CONSTRAINT "school_profile_tenant_id_unique" UNIQUE,
	"display_name" varchar(255) NOT NULL,
	"address_street" varchar(255) DEFAULT '' NOT NULL,
	"address_village" varchar(255) DEFAULT '' NOT NULL,
	"address_district" varchar(255) DEFAULT '' NOT NULL,
	"address_city" varchar(255) DEFAULT '' NOT NULL,
	"address_province" varchar(255) DEFAULT '' NOT NULL,
	"address_postal_code" varchar(5) DEFAULT '' NOT NULL,
	"institutional_email" varchar(255),
	"institutional_phone" varchar(32),
	"website" varchar(2048),
	"latitude" numeric(10,7),
	"longitude" numeric(10,7),
	"description" text,
	"logo_asset_id" varchar(36),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "school_profile_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "school_profile_version_check" CHECK ("version" > 0),
	CONSTRAINT "school_profile_latitude_check" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
	CONSTRAINT "school_profile_longitude_check" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
	CONSTRAINT "school_profile_coordinates_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "school_profile_audit" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"profile_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" varchar(100) NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	CONSTRAINT "school_profile_audit_version_check" CHECK ("from_version" > 0 AND "to_version" = "from_version" + 1)
);
--> statement-breakpoint
CREATE TABLE "security_audit_event" (
	"id" varchar(36) PRIMARY KEY,
	"securityContextKind" "securityCommand_security_context_kind" NOT NULL,
	"context_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36),
	"provider_context_id" varchar(36),
	"sequence" bigint NOT NULL,
	"event_key" varchar(160) NOT NULL,
	"schema_version" integer NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"outcome" "securityAuditEvent_outcome" NOT NULL,
	"actorKind" "securityAuditEvent_actor_kind" NOT NULL,
	"actor_tenant_user_id" varchar(36),
	"actor_provider_user_id" varchar(36),
	"actor_service" varchar(128),
	"command_id" varchar(36) NOT NULL,
	"target_user_id" varchar(36),
	"target_role_id" varchar(36),
	"target_assignment_id" varchar(36),
	"target_school_admin_authority_id" varchar(36),
	"target_school_admin_proof_id" varchar(36),
	"correlation_id" varchar(64) NOT NULL,
	"request_id" varchar(64),
	"reason" varchar(1000),
	"metadata" jsonb NOT NULL,
	"canonical_payload_digest" varchar(64) NOT NULL,
	"previous_hash" varchar(64) NOT NULL,
	"event_hash" varchar(64) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	CONSTRAINT "security_audit_event_sequence_unique" UNIQUE("securityContextKind","context_id","sequence"),
	CONSTRAINT "security_audit_event_key_unique" UNIQUE("securityContextKind","context_id","event_key"),
	CONSTRAINT "security_audit_event_context_check" CHECK ((
      ("securityContextKind" = 'tenant' AND "tenant_id" = "context_id" AND "provider_context_id" IS NULL)
      OR ("securityContextKind" = 'provider' AND "tenant_id" IS NULL AND "provider_context_id" = "context_id" AND "target_user_id" IS NULL AND "target_role_id" IS NULL AND "target_assignment_id" IS NULL AND "target_school_admin_authority_id" IS NULL AND "target_school_admin_proof_id" IS NULL)
    )),
	CONSTRAINT "security_audit_event_actor_check" CHECK ((
      ("actorKind" = 'tenant-user' AND "actor_tenant_user_id" IS NOT NULL AND "actor_provider_user_id" IS NULL AND "actor_service" IS NULL)
      OR ("actorKind" IN ('provider-admin', 'support-recovery') AND "actor_tenant_user_id" IS NULL AND "actor_provider_user_id" IS NOT NULL AND "actor_service" IS NULL)
      OR ("actorKind" = 'system' AND "actor_tenant_user_id" IS NULL AND "actor_provider_user_id" IS NULL AND "actor_service" IS NOT NULL)
    )),
	CONSTRAINT "security_audit_event_hash_check" CHECK ("sequence" > 0 AND "schema_version" > 0 AND "canonical_payload_digest" ~ '^[a-f0-9]{64}$' AND "previous_hash" ~ '^[a-f0-9]{64}$' AND "event_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "security_audit_head" (
	"securityContextKind" "securityCommand_security_context_kind" NOT NULL,
	"context_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36),
	"provider_context_id" varchar(36),
	"next_sequence" bigint DEFAULT 1 NOT NULL,
	"head_hash" varchar(64) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "security_audit_head_partition_unique" UNIQUE("securityContextKind","context_id"),
	CONSTRAINT "security_audit_head_context_check" CHECK ((
      ("securityContextKind" = 'tenant' AND "tenant_id" = "context_id" AND "provider_context_id" IS NULL)
      OR ("securityContextKind" = 'provider' AND "tenant_id" IS NULL AND "provider_context_id" = "context_id")
    )),
	CONSTRAINT "security_audit_head_sequence_check" CHECK ("next_sequence" > 0 AND "version" > 0),
	CONSTRAINT "security_audit_head_hash_check" CHECK ("head_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "security_audit_legal_hold" (
	"id" varchar(36) PRIMARY KEY,
	"securityContextKind" "securityCommand_security_context_kind" NOT NULL,
	"context_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36),
	"provider_context_id" varchar(36),
	"case_id" varchar(128) NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"state" "securityAuditLegalHold_state" DEFAULT 'active'::"securityAuditLegalHold_state" NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"released_at" timestamp(3),
	CONSTRAINT "security_audit_legal_hold_case_unique" UNIQUE("securityContextKind","context_id","case_id"),
	CONSTRAINT "security_audit_legal_hold_context_check" CHECK ((
      ("securityContextKind" = 'tenant' AND "tenant_id" = "context_id" AND "provider_context_id" IS NULL)
      OR ("securityContextKind" = 'provider' AND "tenant_id" IS NULL AND "provider_context_id" = "context_id")
    )),
	CONSTRAINT "security_audit_legal_hold_release_check" CHECK (("state" = 'active' AND "released_at" IS NULL) OR ("state" = 'released' AND "released_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "security_audit_retention_certificate" (
	"id" varchar(36) PRIMARY KEY,
	"securityContextKind" "securityCommand_security_context_kind" NOT NULL,
	"context_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36),
	"provider_context_id" varchar(36),
	"policy_version" integer NOT NULL,
	"retention_days" integer NOT NULL,
	"legal_hold" boolean NOT NULL,
	"tenant_deleted" boolean NOT NULL,
	"retained_count" integer NOT NULL,
	"minimized_count" integer NOT NULL,
	"disposal_eligible_count" integer NOT NULL,
	"event_watermark" varchar(64) NOT NULL,
	"issued_at" timestamp(3) NOT NULL,
	CONSTRAINT "security_audit_retention_certificate_id_unique" UNIQUE("securityContextKind","context_id","id"),
	CONSTRAINT "security_audit_retention_certificate_count_check" CHECK ("retention_days" >= 0 AND "policy_version" > 0 AND "retained_count" >= 0 AND "minimized_count" >= 0 AND "disposal_eligible_count" >= 0),
	CONSTRAINT "security_audit_retention_certificate_context_check" CHECK ((
      ("securityContextKind" = 'tenant' AND "tenant_id" = "context_id" AND "provider_context_id" IS NULL)
      OR ("securityContextKind" = 'provider' AND "tenant_id" IS NULL AND "provider_context_id" = "context_id")
    ))
);
--> statement-breakpoint
CREATE TABLE "security_audit_retention_policy" (
	"securityContextKind" "securityCommand_security_context_kind" NOT NULL,
	"context_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36),
	"provider_context_id" varchar(36),
	"retention_days" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "security_audit_retention_policy_partition_unique" UNIQUE("securityContextKind","context_id"),
	CONSTRAINT "security_audit_retention_policy_days_check" CHECK ("retention_days" >= 0 AND "version" > 0),
	CONSTRAINT "security_audit_retention_policy_context_check" CHECK ((
      ("securityContextKind" = 'tenant' AND "tenant_id" = "context_id" AND "provider_context_id" IS NULL)
      OR ("securityContextKind" = 'provider' AND "tenant_id" IS NULL AND "provider_context_id" = "context_id")
    ))
);
--> statement-breakpoint
CREATE TABLE "security_command" (
	"id" varchar(36) PRIMARY KEY,
	"securityContextKind" "securityCommand_security_context_kind" NOT NULL,
	"context_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36),
	"provider_context_id" varchar(36),
	"idempotency_key" varchar(128) NOT NULL,
	"command_name" varchar(128) NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"status" "securityCommand_status" DEFAULT 'pending'::"securityCommand_status" NOT NULL,
	"result" jsonb,
	"created_at" timestamp(3) NOT NULL,
	"completed_at" timestamp(3),
	CONSTRAINT "security_command_context_id_unique" UNIQUE("securityContextKind","context_id","id"),
	CONSTRAINT "security_command_idempotency_unique" UNIQUE("securityContextKind","context_id","idempotency_key"),
	CONSTRAINT "security_command_context_check" CHECK ((
      ("securityContextKind" = 'tenant' AND "tenant_id" = "context_id" AND "provider_context_id" IS NULL)
      OR ("securityContextKind" = 'provider' AND "tenant_id" IS NULL AND "provider_context_id" = "context_id")
    )),
	CONSTRAINT "security_command_fingerprint_check" CHECK ("fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "security_command_completion_check" CHECK (("status" = 'pending' AND "completed_at" IS NULL) OR ("status" <> 'pending' AND "completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "security_migration_checkpoint" (
	"migration_key" varchar(128) NOT NULL,
	"shard_key" varchar(128) NOT NULL,
	"state" "securityMigrationCheckpoint_state" DEFAULT 'pending'::"securityMigrationCheckpoint_state" NOT NULL,
	"cursor" varchar(255),
	"source_watermark" varchar(255),
	"registry_version" varchar(64) NOT NULL,
	"operation_map_version" varchar(64) NOT NULL,
	"examined_count" integer DEFAULT 0 NOT NULL,
	"migrated_count" integer DEFAULT 0 NOT NULL,
	"finding_count" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp(3),
	"completed_at" timestamp(3),
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "security_migration_checkpoint_unique" UNIQUE("migration_key","shard_key"),
	CONSTRAINT "security_migration_checkpoint_counts_check" CHECK ("examined_count" >= 0 AND "migrated_count" >= 0 AND "finding_count" >= 0 AND "version" > 0),
	CONSTRAINT "security_migration_checkpoint_state_check" CHECK ((
      ("state" = 'pending' AND "started_at" IS NULL AND "completed_at" IS NULL)
      OR ("state" IN ('running', 'blocked') AND "started_at" IS NOT NULL AND "completed_at" IS NULL)
      OR ("state" = 'completed' AND "started_at" IS NOT NULL AND "completed_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "security_outbox" (
	"id" varchar(36) PRIMARY KEY,
	"securityContextKind" "securityCommand_security_context_kind" NOT NULL,
	"context_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36),
	"provider_context_id" varchar(36),
	"command_id" varchar(36) NOT NULL,
	"event_key" varchar(160) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	"available_at" timestamp(3) NOT NULL,
	"published_at" timestamp(3),
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "security_outbox_event_unique" UNIQUE("securityContextKind","context_id","event_key"),
	CONSTRAINT "security_outbox_attempts_check" CHECK ("attempts" >= 0),
	CONSTRAINT "security_outbox_context_check" CHECK ((
      ("securityContextKind" = 'tenant' AND "tenant_id" = "context_id" AND "provider_context_id" IS NULL)
      OR ("securityContextKind" = 'provider' AND "tenant_id" IS NULL AND "provider_context_id" = "context_id")
    ))
);
--> statement-breakpoint
CREATE TABLE "security_reconciliation_finding" (
	"id" varchar(36) PRIMARY KEY,
	"migration_key" varchar(128) NOT NULL,
	"scope_key" varchar(128) NOT NULL,
	"finding_key" varchar(160) NOT NULL,
	"tenant_id" varchar(36),
	"user_id" varchar(36),
	"reason_code" varchar(100) NOT NULL,
	"severity" "securityReconciliationFinding_severity" NOT NULL,
	"state" "securityReconciliationFinding_state" DEFAULT 'open'::"securityReconciliationFinding_state" NOT NULL,
	"safe_details" jsonb NOT NULL,
	"detected_at" timestamp(3) NOT NULL,
	"resolved_at" timestamp(3),
	CONSTRAINT "security_reconciliation_finding_unique" UNIQUE("migration_key","scope_key","finding_key"),
	CONSTRAINT "security_reconciliation_scope_check" CHECK ("tenant_id" IS NULL OR "scope_key" = "tenant_id"),
	CONSTRAINT "security_reconciliation_user_scope_check" CHECK ("user_id" IS NULL OR "tenant_id" IS NOT NULL),
	CONSTRAINT "security_reconciliation_resolution_check" CHECK (("state" = 'open' AND "resolved_at" IS NULL) OR ("state" <> 'open' AND "resolved_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(36) PRIMARY KEY,
	"expires_at" timestamp(3) NOT NULL,
	"token" varchar(255) NOT NULL UNIQUE,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" varchar(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simas_application" (
	"id" varchar(36) PRIMARY KEY,
	"school_name" varchar(255) NOT NULL,
	"npsn" varchar(20) NOT NULL,
	"education_level" varchar(64) NOT NULL,
	"address" text NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"contact_position" varchar(255) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_whatsapp" varchar(32) NOT NULL,
	"needs_note" text,
	"status" "simasApplication_status" DEFAULT 'pending'::"simasApplication_status" NOT NULL,
	"submitted_at" timestamp(3) DEFAULT now() NOT NULL,
	"decided_at" timestamp(3),
	"decided_by_provider_admin_id" varchar(36),
	"rejection_reason" text,
	"approved_tenant_id" varchar(36) CONSTRAINT "simas_application_approved_tenant_id_unique" UNIQUE,
	"owner_user_id" varchar(36) NOT NULL,
	"binding_id" varchar(36) NOT NULL,
	"attempt_number" integer NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"pending_binding_id" varchar(36) GENERATED ALWAYS AS (CASE WHEN status = 'pending' THEN binding_id ELSE NULL END) STORED CONSTRAINT "simas_application_pending_binding_unique" UNIQUE,
	CONSTRAINT "simas_application_binding_attempt_unique" UNIQUE("binding_id","attempt_number"),
	CONSTRAINT "simas_application_owner_idempotency_unique" UNIQUE("owner_user_id","idempotency_key"),
	CONSTRAINT "simas_application_attempt_number_check" CHECK ("attempt_number" > 0),
	CONSTRAINT "simas_application_decision_state_check" CHECK ((
        ("status" = 'pending' AND "decided_at" IS NULL AND "decided_by_provider_admin_id" IS NULL AND "rejection_reason" IS NULL AND "approved_tenant_id" IS NULL)
        OR ("status" = 'approved' AND "decided_at" IS NOT NULL AND "decided_by_provider_admin_id" IS NOT NULL AND "rejection_reason" IS NULL AND "approved_tenant_id" IS NOT NULL)
        OR ("status" = 'rejected' AND "decided_at" IS NOT NULL AND "decided_by_provider_admin_id" IS NOT NULL AND LENGTH(TRIM("rejection_reason")) > 0 AND "approved_tenant_id" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "staff_audit" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"person_id" varchar(36) NOT NULL,
	"staff_id" varchar(36),
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "staffAudit_operation" NOT NULL,
	"from_person_version" integer NOT NULL,
	"to_person_version" integer NOT NULL,
	"from_staff_version" integer NOT NULL,
	"to_staff_version" integer NOT NULL,
	"sensitive_before" jsonb,
	"sensitive_after" jsonb,
	"lifecycle_before" jsonb,
	"lifecycle_after" jsonb,
	"reason" varchar(1000),
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_position_assignment" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"staff_id" varchar(36) NOT NULL,
	"position" "staffProfile_position" NOT NULL,
	"position_other" varchar(100),
	"work_unit" varchar(150),
	"notes" text,
	"started_at" date NOT NULL,
	"ended_at" date,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "staff_position_assignment_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"),
	CONSTRAINT "staff_position_assignment_other_check" CHECK ("position" <> 'other' OR "position_other" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "staff_profile" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"person_id" varchar(36) NOT NULL,
	"staff_number" varchar(50) NOT NULL,
	"normalized_staff_number" varchar(50) NOT NULL,
	"position" "staffProfile_position" NOT NULL,
	"position_other" varchar(100),
	"employmentType" "staffProfile_employment_type" NOT NULL,
	"employment_type_other" varchar(100),
	"service_start_date" date NOT NULL,
	"status" "teacherProfile_status" DEFAULT 'active'::"teacherProfile_status" NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "staff_profile_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "staff_profile_tenant_person_unique" UNIQUE("tenant_id","person_id"),
	CONSTRAINT "staff_profile_tenant_number_unique" UNIQUE("tenant_id","normalized_staff_number"),
	CONSTRAINT "staff_profile_position_other_check" CHECK ("position" <> 'other' OR "position_other" IS NOT NULL),
	CONSTRAINT "staff_profile_employment_other_check" CHECK ("employmentType" <> 'other' OR "employment_type_other" IS NOT NULL),
	CONSTRAINT "staff_profile_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "staff_relationship" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"staff_id" varchar(36) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_service_period" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"staff_id" varchar(36) NOT NULL,
	"status" "teacherProfile_status" NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(500) NOT NULL,
	"notes" text,
	"corrected" boolean DEFAULT false NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "staff_service_period_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "student_audit" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"person_id" varchar(36) NOT NULL,
	"student_id" varchar(36),
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "studentAudit_operation" NOT NULL,
	"from_person_version" integer NOT NULL,
	"to_person_version" integer NOT NULL,
	"from_student_version" integer NOT NULL,
	"to_student_version" integer NOT NULL,
	"sensitive_before" jsonb,
	"sensitive_after" jsonb,
	"lifecycle_before" jsonb,
	"lifecycle_after" jsonb,
	"reason" varchar(1000),
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_lifecycle_period" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"status" "studentProfile_status" NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(500) NOT NULL,
	"notes" text,
	"corrected" boolean DEFAULT false NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "student_lifecycle_period_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "student_organization" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(150) NOT NULL,
	"normalized_name" varchar(150) NOT NULL,
	"abbreviation" varchar(30),
	"code" varchar(30) NOT NULL,
	"normalized_code" varchar(30) NOT NULL,
	"description" text,
	"founding_date" date,
	"secretariat_location_id" varchar(36),
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(1000),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "student_organization_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "student_organization_tenant_code_unique" UNIQUE("tenant_id","normalized_code"),
	CONSTRAINT "student_organization_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "student_profile" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"person_id" varchar(36) NOT NULL,
	"nis" varchar(50) NOT NULL,
	"normalized_nis" varchar(50) NOT NULL,
	"nisn" varchar(10),
	"external_student_id" varchar(100),
	"entry_date" date NOT NULL,
	"status" "studentProfile_status" DEFAULT 'active'::"studentProfile_status" NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "student_profile_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "student_profile_tenant_person_unique" UNIQUE("tenant_id","person_id"),
	CONSTRAINT "student_profile_tenant_nis_unique" UNIQUE("tenant_id","normalized_nis"),
	CONSTRAINT "student_profile_tenant_nisn_unique" UNIQUE("tenant_id","nisn"),
	CONSTRAINT "student_profile_nisn_check" CHECK ("nisn" IS NULL OR "nisn" ~ '^[0-9]{10}$'),
	CONSTRAINT "student_profile_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "student_relationship" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"phone" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"code" varchar(30) NOT NULL,
	"normalized_code" varchar(30) NOT NULL,
	"name" varchar(150) NOT NULL,
	"normalized_name" varchar(150) NOT NULL,
	"education_levels" varchar(50) NOT NULL,
	"description" text,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "subject_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "subject_tenant_normalized_code_unique" UNIQUE("tenant_id","normalized_code"),
	CONSTRAINT "subject_tenant_normalized_name_unique" UNIQUE("tenant_id","normalized_name"),
	CONSTRAINT "subject_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "subject_history" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"subject_id" varchar(36) NOT NULL,
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "subjectHistory_operation" NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	CONSTRAINT "subject_history_version_check" CHECK ("from_version" >= 0 AND "to_version" = "from_version" + 1)
);
--> statement-breakpoint
CREATE TABLE "teacher_audit" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"person_id" varchar(36) NOT NULL,
	"teacher_id" varchar(36),
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "teacherAudit_operation" NOT NULL,
	"from_person_version" integer NOT NULL,
	"to_person_version" integer NOT NULL,
	"from_teacher_version" integer NOT NULL,
	"to_teacher_version" integer NOT NULL,
	"sensitive_before" jsonb,
	"sensitive_after" jsonb,
	"lifecycle_before" jsonb,
	"lifecycle_after" jsonb,
	"reason" varchar(1000),
	"occurred_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_profile" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"person_id" varchar(36) NOT NULL,
	"teacher_number" varchar(50) NOT NULL,
	"normalized_teacher_number" varchar(50) NOT NULL,
	"nuptk" varchar(16),
	"employmentType" "teacherProfile_employment_type" NOT NULL,
	"service_start_date" date NOT NULL,
	"status" "teacherProfile_status" DEFAULT 'active'::"teacherProfile_status" NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3),
	"archive_reason" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "teacher_profile_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "teacher_profile_tenant_person_unique" UNIQUE("tenant_id","person_id"),
	CONSTRAINT "teacher_profile_tenant_number_unique" UNIQUE("tenant_id","normalized_teacher_number"),
	CONSTRAINT "teacher_profile_tenant_nuptk_unique" UNIQUE("tenant_id","nuptk"),
	CONSTRAINT "teacher_profile_nuptk_check" CHECK ("nuptk" IS NULL OR "nuptk" ~ '^[0-9]{16}$'),
	CONSTRAINT "teacher_profile_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "teacher_relationship" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"teacher_id" varchar(36) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_service_period" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"teacher_id" varchar(36) NOT NULL,
	"status" "teacherProfile_status" NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"reason" varchar(500) NOT NULL,
	"notes" text,
	"corrected" boolean DEFAULT false NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "teacher_service_period_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "teaching_assignment" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"teacher_profile_id" varchar(36) NOT NULL,
	"subject_id" varchar(36) NOT NULL,
	"class_group_id" varchar(36) NOT NULL,
	"academic_year_id" varchar(36) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"status" "teachingAssignment_status" DEFAULT 'planned'::"teachingAssignment_status" NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "teaching_assignment_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "teaching_assignment_version_check" CHECK ("version" > 0),
	CONSTRAINT "teaching_assignment_range_check" CHECK ("ends_on" IS NULL OR "ends_on" > "starts_on")
);
--> statement-breakpoint
CREATE TABLE "teaching_assignment_event" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"teaching_assignment_id" varchar(36) NOT NULL,
	"replacement_assignment_id" varchar(36),
	"actor_user_id" varchar(36) NOT NULL,
	"operation" "teachingAssignmentEvent_operation" NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"effective_on" date NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	CONSTRAINT "teaching_assignment_event_version_check" CHECK ("from_version" >= 0 AND "to_version" = "from_version" + 1)
);
--> statement-breakpoint
CREATE TABLE "temporary_credential_activation" (
	"user_id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"temporary_credential_issued_at" timestamp(3) NOT NULL,
	"first_authenticated_at" timestamp(3),
	"password_change_required" boolean DEFAULT true NOT NULL,
	"password_changed_at" timestamp(3),
	CONSTRAINT "temporary_credential_activation_password_state_check" CHECK ((("password_change_required" = true AND "password_changed_at" IS NULL) OR ("password_change_required" = false AND "password_changed_at" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" varchar(36) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL UNIQUE,
	"npsn" varchar(20) NOT NULL UNIQUE,
	"source_application_id" varchar(36) NOT NULL UNIQUE,
	"approved_at" timestamp(3) NOT NULL,
	"onboarding_completed_at" timestamp(3),
	"trial_started_at" timestamp(3),
	"trial_ends_at" timestamp(3),
	"settings" jsonb,
	"operationalStatus" "tenant_operational_status",
	"reconciliationStatus" "tenant_reconciliation_status",
	"deletion_waiting_days" integer,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_onboarding_trial_state_check" CHECK ((
        ("onboarding_completed_at" IS NULL AND "trial_started_at" IS NULL AND "trial_ends_at" IS NULL)
        OR ("onboarding_completed_at" IS NOT NULL AND "trial_started_at" = "onboarding_completed_at" AND "trial_ends_at" IS NOT NULL AND "trial_ends_at" > "trial_started_at")
      )),
	CONSTRAINT "tenant_deletion_waiting_days_check" CHECK ("deletion_waiting_days" IS NULL OR ("deletion_waiting_days" >= 1 AND "deletion_waiting_days" <= 365))
);
--> statement-breakpoint
CREATE TABLE "tenant_account_lifecycle_case" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"kind" "tenantAccountLifecycleCase_kind" NOT NULL,
	"state" "tenantAccountLifecycleCase_state" NOT NULL,
	"deliveryChannel" "tenantAccountLifecycleCase_delivery_channel" NOT NULL,
	"secret_digest" varchar(128),
	"expires_at" timestamp(3),
	"consumed_at" timestamp(3),
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"pending_slot" boolean GENERATED ALWAYS AS (CASE WHEN state = 'pending' THEN true ELSE NULL END) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "tenant_account_case_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tenant_account_case_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "tenant_account_case_pending_unique" UNIQUE("tenant_id","user_id","kind","pending_slot"),
	CONSTRAINT "tenant_account_case_version_check" CHECK ("version" > 0 AND "delivery_attempts" >= 0),
	CONSTRAINT "tenant_account_case_material_check" CHECK (("state" <> 'pending') OR ("secret_digest" IS NOT NULL AND "expires_at" IS NOT NULL AND "consumed_at" IS NULL)),
	CONSTRAINT "tenant_account_case_consumed_check" CHECK (("state" <> 'completed') OR "consumed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "tenant_account_security" (
	"tenant_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL CONSTRAINT "tenant_account_security_user_unique" UNIQUE,
	"lifecycle" "tenantAccountSecurity_lifecycle" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"assignment_version" integer DEFAULT 1 NOT NULL,
	"activated_at" timestamp(3),
	"deactivated_at" timestamp(3),
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "tenant_account_security_tenant_user_unique" UNIQUE("tenant_id","user_id"),
	CONSTRAINT "tenant_account_security_version_check" CHECK ("version" > 0 AND "assignment_version" > 0),
	CONSTRAINT "tenant_account_security_lifecycle_check" CHECK ((
      ("lifecycle" = 'pending-activation' AND "activated_at" IS NULL AND "deactivated_at" IS NULL)
      OR ("lifecycle" = 'active' AND "activated_at" IS NOT NULL AND "deactivated_at" IS NULL)
      OR ("lifecycle" = 'inactive' AND "deactivated_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "tenant_openwa_credential" (
	"tenant_id" varchar(36) PRIMARY KEY,
	"api_base_url" varchar(255),
	"api_key_ciphertext" varchar(512) NOT NULL,
	"session_key" varchar(255) NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_operational_migration_checkpoint" (
	"migration_key" varchar(100) PRIMARY KEY,
	"last_tenant_id" varchar(36),
	"examined_count" integer DEFAULT 0 NOT NULL,
	"migrated_count" integer DEFAULT 0 NOT NULL,
	"reconciliation_count" integer DEFAULT 0 NOT NULL,
	"access_difference_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp(3),
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_operational_migration_examined_check" CHECK ("examined_count" >= 0),
	CONSTRAINT "tenant_operational_migration_migrated_check" CHECK ("migrated_count" >= 0),
	CONSTRAINT "tenant_operational_migration_reconciliation_check" CHECK ("reconciliation_count" >= 0),
	CONSTRAINT "tenant_operational_migration_access_difference_check" CHECK ("access_difference_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tenant_rbac_rollout" (
	"tenant_id" varchar(36) PRIMARY KEY,
	"httpMode" "tenantRbacRollout_http_mode" DEFAULT 'legacy'::"tenantRbacRollout_http_mode" NOT NULL,
	"workerMode" "tenantRbacRollout_http_mode" DEFAULT 'legacy'::"tenantRbacRollout_http_mode" NOT NULL,
	"epoch" bigint DEFAULT 1 NOT NULL,
	"resolver_version" varchar(64) NOT NULL,
	"registry_version" varchar(64) NOT NULL,
	"operation_map_version" varchar(64) NOT NULL,
	"overlay_hash" varchar(64),
	"overlay_policy_version" varchar(64),
	"overlay_denied_operation_ids" jsonb,
	"overlay_denied_permission_keys" jsonb,
	"overlay_deny_mutations" boolean,
	"overlay_review_at" timestamp(3),
	"overlay_expires_at" timestamp(3),
	"multi_role_accepted_at" timestamp(3),
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "tenant_rbac_rollout_version_check" CHECK ("version" > 0 AND "epoch" > 0),
	CONSTRAINT "tenant_rbac_rollout_emergency_check" CHECK ((
      ("httpMode" = 'rbac-emergency' AND "workerMode" = 'rbac-emergency'
        AND "overlay_hash" ~ '^[a-f0-9]{64}$'
        AND "overlay_policy_version" IS NOT NULL
        AND "overlay_denied_operation_ids" IS NOT NULL
        AND "overlay_denied_permission_keys" IS NOT NULL
        AND "overlay_deny_mutations" IS NOT NULL
        AND "overlay_review_at" IS NOT NULL
        AND "overlay_expires_at" IS NOT NULL
        AND "overlay_review_at" <= "overlay_expires_at")
      OR ("httpMode" <> 'rbac-emergency' AND "workerMode" <> 'rbac-emergency'
        AND "overlay_hash" IS NULL
        AND "overlay_policy_version" IS NULL
        AND "overlay_denied_operation_ids" IS NULL
        AND "overlay_denied_permission_keys" IS NULL
        AND "overlay_deny_mutations" IS NULL
        AND "overlay_review_at" IS NULL
        AND "overlay_expires_at" IS NULL)
    )),
	CONSTRAINT "tenant_rbac_rollout_rollback_check" CHECK ("multi_role_accepted_at" IS NULL OR ("httpMode" IN ('rbac', 'rbac-emergency') AND "workerMode" IN ('rbac', 'rbac-emergency')))
);
--> statement-breakpoint
CREATE TABLE "tenant_role" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(150) NOT NULL,
	"normalized_name" varchar(150) NOT NULL,
	"description" text,
	"lifecycle" "tenantRole_lifecycle" DEFAULT 'draft'::"tenantRole_lifecycle" NOT NULL,
	"origin" "tenantRole_origin" NOT NULL,
	"template_key" varchar(100),
	"template_version" varchar(64),
	"copied_from_role_id" varchar(36),
	"legacyRole" "tenantRole_legacy_role",
	"migration_run_id" varchar(36),
	"migration_version" varchar(64),
	"migrationVerification" "tenantRole_migration_verification",
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "tenant_role_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tenant_role_tenant_name_unique" UNIQUE("tenant_id","normalized_name"),
	CONSTRAINT "tenant_role_name_check" CHECK (LENGTH(TRIM("name")) > 0 AND LENGTH(TRIM("normalized_name")) > 0),
	CONSTRAINT "tenant_role_version_check" CHECK ("version" > 0),
	CONSTRAINT "tenant_role_provenance_check" CHECK ((
      ("origin" = 'scratch' AND "template_key" IS NULL AND "template_version" IS NULL AND "copied_from_role_id" IS NULL AND "legacyRole" IS NULL AND "migration_run_id" IS NULL AND "migration_version" IS NULL AND "migrationVerification" IS NULL)
      OR ("origin" = 'template' AND "template_key" IS NOT NULL AND "template_version" IS NOT NULL AND "copied_from_role_id" IS NULL AND "legacyRole" IS NULL AND "migration_run_id" IS NULL AND "migration_version" IS NULL AND "migrationVerification" IS NULL)
      OR ("origin" = 'copy' AND "template_key" IS NULL AND "template_version" IS NULL AND "copied_from_role_id" IS NOT NULL AND "legacyRole" IS NULL AND "migration_run_id" IS NULL AND "migration_version" IS NULL AND "migrationVerification" IS NULL)
      OR ("origin" = 'legacy-migration' AND "template_key" IS NULL AND "template_version" IS NULL AND "copied_from_role_id" IS NULL AND "legacyRole" IS NOT NULL AND "migration_run_id" IS NOT NULL AND "migration_version" IS NOT NULL AND "migrationVerification" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "tenant_role_assignment" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"role_id" varchar(36) NOT NULL,
	"state" "tenantRoleAssignment_state" DEFAULT 'active'::"tenantRoleAssignment_state" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"assigned_at" timestamp(3) NOT NULL,
	"suspended_at" timestamp(3),
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "tenant_role_assignment_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tenant_role_assignment_user_role_unique" UNIQUE("tenant_id","user_id","role_id"),
	CONSTRAINT "tenant_role_assignment_version_check" CHECK ("version" > 0),
	CONSTRAINT "tenant_role_assignment_state_check" CHECK (("state" = 'active' AND "suspended_at" IS NULL) OR ("state" = 'suspended' AND "suspended_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "tenant_role_menu_visibility" (
	"tenant_id" varchar(36) NOT NULL,
	"role_id" varchar(36) NOT NULL,
	"menu_key" varchar(100) NOT NULL,
	"visible" boolean NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "tenant_role_menu_visibility_unique" UNIQUE("tenant_id","role_id","menu_key")
);
--> statement-breakpoint
CREATE TABLE "tenant_role_permission" (
	"tenant_id" varchar(36) NOT NULL,
	"role_id" varchar(36) NOT NULL,
	"permission_key" varchar(255) NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	CONSTRAINT "tenant_role_permission_unique" UNIQUE("tenant_id","role_id","permission_key"),
	CONSTRAINT "tenant_role_permission_key_check" CHECK ("permission_key" ~ '^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "transactional_outbox" (
	"id" varchar(36) PRIMARY KEY,
	"event_type" varchar(100) NOT NULL,
	"aggregate_type" varchar(64) NOT NULL,
	"aggregate_id" varchar(36) NOT NULL,
	"event_identity" varchar(255) DEFAULT 'legacy' NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp(3) NOT NULL,
	"published_at" timestamp(3),
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "transactional_outbox_event_identity_unique" UNIQUE("event_type","aggregate_type","aggregate_id","event_identity"),
	CONSTRAINT "transactional_outbox_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36),
	"tenantRole" "user_tenant_role",
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "user_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" varchar(36) PRIMARY KEY,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_bot_connection" (
	"tenant_id" varchar(36) NOT NULL CONSTRAINT "whatsapp_bot_connection_tenant_unique" UNIQUE,
	"openwa_session_id" varchar(36) NOT NULL CONSTRAINT "whatsapp_bot_connection_session_id_unique" UNIQUE,
	"openwa_session_name" varchar(128) NOT NULL CONSTRAINT "whatsapp_bot_connection_session_name_unique" UNIQUE,
	"openwa_webhook_id" varchar(64) NOT NULL,
	"status" "whatsappBotConnection_status" DEFAULT 'connected'::"whatsappBotConnection_status" NOT NULL,
	"bot_phone" varchar(32),
	"bot_push_name" varchar(255),
	"last_error" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_bot_message" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"openwa_message_id" varchar(128) NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"event" varchar(64) DEFAULT 'message.received' NOT NULL,
	"direction" "whatsappBotMessage_direction" DEFAULT 'inbound'::"whatsappBotMessage_direction" NOT NULL,
	"chat_id" varchar(32) NOT NULL,
	"from_wa" varchar(32) NOT NULL,
	"to_wa" varchar(32),
	"body" text,
	"message_type" varchar(32),
	"has_media" boolean DEFAULT false NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"kind" varchar(32),
	"metadata" jsonb,
	"message_timestamp" bigint,
	"received_at" timestamp(3) DEFAULT now() NOT NULL,
	"sent_at" timestamp(3),
	"delivery_status" varchar(32),
	CONSTRAINT "whatsapp_bot_message_tenant_idempotency_unique" UNIQUE("tenant_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_bot_request" (
	"id" varchar(36) PRIMARY KEY,
	"tenant_id" varchar(36) NOT NULL,
	"requested_phone" varchar(16) NOT NULL,
	"desired_session_name" varchar(50),
	"pic_name" varchar(128) NOT NULL,
	"note" text,
	"status" "whatsapp_bot_request_status" DEFAULT 'pending'::"whatsapp_bot_request_status" NOT NULL,
	"provider_note" text,
	"resolutionMethod" "whatsappBotRequest_resolution_method",
	"openwa_session_id" varchar(36),
	"resolved_at" timestamp(3),
	"resolved_by" varchar(36),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "academic_preview_tenant_state_expiry_idx" ON "academic_operation_preview" ("tenant_id","state","expires_at");--> statement-breakpoint
CREATE INDEX "academic_year_tenant_period_idx" ON "academic_year" ("tenant_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "academic_year_history_tenant_year_idx" ON "academic_year_history" ("tenant_id","academic_year_id","occurred_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "activity_advisor_history_idx" ON "activity_advisor" ("tenant_id","group_id","advisor_id","started_at");--> statement-breakpoint
CREATE INDEX "activity_event_history_idx" ON "activity_event" ("tenant_id","extracurricular_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activity_group_history_idx" ON "activity_group" ("tenant_id","extracurricular_id","academic_year_id","start_date");--> statement-breakpoint
CREATE INDEX "activity_participant_capacity_idx" ON "activity_participant" ("tenant_id","group_id","started_at","ended_at");--> statement-breakpoint
CREATE INDEX "attendance_record_tenant_student_layer_recorded_idx" ON "attendance_record" ("tenant_id","student_id","layer","recorded_at");--> statement-breakpoint
CREATE INDEX "attendance_record_tenant_session_idx" ON "attendance_record" ("tenant_id","session_id");--> statement-breakpoint
CREATE INDEX "class_group_tenant_archive_name_idx" ON "class_group" ("tenant_id","archived","normalized_group_name");--> statement-breakpoint
CREATE INDEX "class_group_history_tenant_group_idx" ON "class_group_history" ("tenant_id","class_group_id","occurred_at");--> statement-breakpoint
CREATE INDEX "class_group_relationship_tenant_active_idx" ON "class_group_relationship" ("tenant_id","class_group_id","active");--> statement-breakpoint
CREATE INDEX "class_membership_tenant_student_history_idx" ON "class_membership" ("tenant_id","student_id","started_at");--> statement-breakpoint
CREATE INDEX "class_membership_tenant_group_history_idx" ON "class_membership" ("tenant_id","class_group_id","started_at");--> statement-breakpoint
CREATE INDEX "class_relationship_event_tenant_relationship_idx" ON "class_relationship_event" ("tenant_id","kind","relationship_id","occurred_at");--> statement-breakpoint
CREATE INDEX "extracurricular_tenant_archive_name_idx" ON "extracurricular" ("tenant_id","archived","normalized_name");--> statement-breakpoint
CREATE INDEX "headmaster_assignment_tenant_history_idx" ON "headmaster_assignment" ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "headmaster_audit_tenant_assignment_idx" ON "headmaster_assignment_audit" ("tenant_id","assignment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "homeroom_tenant_group_history_idx" ON "homeroom_assignment" ("tenant_id","class_group_id","started_at");--> statement-breakpoint
CREATE INDEX "homeroom_tenant_teacher_history_idx" ON "homeroom_assignment" ("tenant_id","teacher_id","started_at");--> statement-breakpoint
CREATE INDEX "inventory_asset_tenant_archive_name_idx" ON "inventory_asset" ("tenant_id","archived","normalized_name");--> statement-breakpoint
CREATE INDEX "inventory_history_tenant_asset_idx" ON "inventory_asset_history" ("tenant_id","asset_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_reference_tenant_active_idx" ON "inventory_asset_reference" ("tenant_id","asset_id","active");--> statement-breakpoint
CREATE INDEX "location_tenant_archive_name_idx" ON "location" ("tenant_id","archived","normalized_name");--> statement-breakpoint
CREATE INDEX "location_history_tenant_location_idx" ON "location_history" ("tenant_id","location_id","occurred_at");--> statement-breakpoint
CREATE INDEX "location_reference_tenant_active_idx" ON "location_reference" ("tenant_id","location_id","active");--> statement-breakpoint
CREATE INDEX "organization_event_history_idx" ON "organization_event" ("tenant_id","organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "organization_leadership_history_idx" ON "organization_leadership" ("tenant_id","period_id","normalized_position_name","started_at");--> statement-breakpoint
CREATE INDEX "organization_membership_history_idx" ON "organization_membership" ("tenant_id","organization_id","student_id","started_at");--> statement-breakpoint
CREATE INDEX "organization_period_history_idx" ON "organization_period" ("tenant_id","organization_id","start_date");--> statement-breakpoint
CREATE INDEX "ppdb_session_tenant_status_idx" ON "ppdb_session" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ppdb_submission_tenant_session_idx" ON "ppdb_submission" ("tenant_id","session_id","submitted_at");--> statement-breakpoint
CREATE INDEX "ppdb_submission_document_submission_idx" ON "ppdb_submission_document" ("tenant_id","submission_id");--> statement-breakpoint
CREATE INDEX "quiz_answer_tenant_sheet_idx" ON "quiz_answer" ("tenant_id","answer_sheet_id");--> statement-breakpoint
CREATE INDEX "quiz_answer_sheet_tenant_session_idx" ON "quiz_answer_sheet" ("tenant_id","session_id");--> statement-breakpoint
CREATE INDEX "quiz_attendance_tenant_session_idx" ON "quiz_attendance" ("tenant_id","session_id");--> statement-breakpoint
CREATE INDEX "quiz_question_tenant_session_idx" ON "quiz_question" ("tenant_id","session_id");--> statement-breakpoint
CREATE INDEX "quiz_session_tenant_status_idx" ON "quiz_session" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "quiz_session_tenant_class_group_idx" ON "quiz_session" ("tenant_id","class_group_id");--> statement-breakpoint
CREATE INDEX "school_accreditation_tenant_period_idx" ON "school_accreditation" ("tenant_id","determination_date","expiry_date");--> statement-breakpoint
CREATE INDEX "school_admin_authority_roster_idx" ON "school_admin_authority" ("tenant_id","authorityState","user_id");--> statement-breakpoint
CREATE INDEX "school_admin_proof_authority_state_idx" ON "school_admin_proof" ("tenant_id","authority_id","proofState");--> statement-breakpoint
CREATE INDEX "school_person_tenant_name_idx" ON "school_person" ("tenant_id","normalized_name");--> statement-breakpoint
CREATE INDEX "school_person_audit_tenant_person_idx" ON "school_person_audit" ("tenant_id","person_id","occurred_at");--> statement-breakpoint
CREATE INDEX "school_profile_audit_tenant_profile_idx" ON "school_profile_audit" ("tenant_id","profile_id","occurred_at");--> statement-breakpoint
CREATE INDEX "security_audit_event_type_idx" ON "security_audit_event" ("securityContextKind","context_id","event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "security_audit_event_target_user_idx" ON "security_audit_event" ("tenant_id","target_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "security_audit_legal_hold_state_idx" ON "security_audit_legal_hold" ("securityContextKind","context_id","state");--> statement-breakpoint
CREATE INDEX "security_audit_retention_certificate_context_idx" ON "security_audit_retention_certificate" ("securityContextKind","context_id","issued_at");--> statement-breakpoint
CREATE INDEX "security_command_status_idx" ON "security_command" ("status","created_at");--> statement-breakpoint
CREATE INDEX "security_migration_checkpoint_state_idx" ON "security_migration_checkpoint" ("migration_key","state","shard_key");--> statement-breakpoint
CREATE INDEX "security_outbox_pending_idx" ON "security_outbox" ("published_at","available_at");--> statement-breakpoint
CREATE INDEX "security_reconciliation_state_idx" ON "security_reconciliation_finding" ("state","severity","detected_at");--> statement-breakpoint
CREATE INDEX "security_reconciliation_tenant_idx" ON "security_reconciliation_finding" ("tenant_id","state","reason_code");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "staff_audit_tenant_staff_idx" ON "staff_audit" ("tenant_id","staff_id","occurred_at");--> statement-breakpoint
CREATE INDEX "staff_position_assignment_tenant_staff_idx" ON "staff_position_assignment" ("tenant_id","staff_id","started_at");--> statement-breakpoint
CREATE INDEX "staff_profile_tenant_status_archive_idx" ON "staff_profile" ("tenant_id","status","archived");--> statement-breakpoint
CREATE INDEX "staff_relationship_tenant_staff_active_idx" ON "staff_relationship" ("tenant_id","staff_id","active");--> statement-breakpoint
CREATE INDEX "staff_service_period_tenant_staff_idx" ON "staff_service_period" ("tenant_id","staff_id","started_at");--> statement-breakpoint
CREATE INDEX "student_audit_tenant_student_idx" ON "student_audit" ("tenant_id","student_id","occurred_at");--> statement-breakpoint
CREATE INDEX "student_lifecycle_period_tenant_student_idx" ON "student_lifecycle_period" ("tenant_id","student_id","started_at");--> statement-breakpoint
CREATE INDEX "student_organization_tenant_archive_name_idx" ON "student_organization" ("tenant_id","archived","normalized_name");--> statement-breakpoint
CREATE INDEX "student_profile_tenant_status_archive_idx" ON "student_profile" ("tenant_id","status","archived");--> statement-breakpoint
CREATE INDEX "student_relationship_tenant_student_active_idx" ON "student_relationship" ("tenant_id","student_id","active");--> statement-breakpoint
CREATE INDEX "subject_tenant_archive_name_idx" ON "subject" ("tenant_id","archived","normalized_name");--> statement-breakpoint
CREATE INDEX "subject_history_tenant_subject_idx" ON "subject_history" ("tenant_id","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "teacher_audit_tenant_teacher_idx" ON "teacher_audit" ("tenant_id","teacher_id","occurred_at");--> statement-breakpoint
CREATE INDEX "teacher_profile_tenant_status_archive_idx" ON "teacher_profile" ("tenant_id","status","archived");--> statement-breakpoint
CREATE INDEX "teacher_relationship_tenant_teacher_active_idx" ON "teacher_relationship" ("tenant_id","teacher_id","active");--> statement-breakpoint
CREATE INDEX "teacher_service_period_tenant_teacher_idx" ON "teacher_service_period" ("tenant_id","teacher_id","started_at");--> statement-breakpoint
CREATE INDEX "teaching_assignment_scope_idx" ON "teaching_assignment" ("tenant_id","teacher_profile_id","subject_id","class_group_id","academic_year_id","status","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "teaching_assignment_event_scope_idx" ON "teaching_assignment_event" ("tenant_id","teaching_assignment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "tenant_account_case_user_state_idx" ON "tenant_account_lifecycle_case" ("tenant_id","user_id","kind","state");--> statement-breakpoint
CREATE INDEX "tenant_account_security_state_idx" ON "tenant_account_security" ("tenant_id","lifecycle","user_id");--> statement-breakpoint
CREATE INDEX "tenant_rbac_rollout_modes_idx" ON "tenant_rbac_rollout" ("httpMode","workerMode","epoch");--> statement-breakpoint
CREATE INDEX "tenant_role_tenant_lifecycle_idx" ON "tenant_role" ("tenant_id","lifecycle","normalized_name");--> statement-breakpoint
CREATE INDEX "tenant_role_assignment_user_state_idx" ON "tenant_role_assignment" ("tenant_id","user_id","state");--> statement-breakpoint
CREATE INDEX "tenant_role_assignment_role_state_idx" ON "tenant_role_assignment" ("tenant_id","role_id","state");--> statement-breakpoint
CREATE INDEX "tenant_role_menu_visibility_role_idx" ON "tenant_role_menu_visibility" ("tenant_id","role_id");--> statement-breakpoint
CREATE INDEX "tenant_role_permission_key_idx" ON "tenant_role_permission" ("permission_key","tenant_id");--> statement-breakpoint
CREATE INDEX "transactional_outbox_pending_idx" ON "transactional_outbox" ("published_at","occurred_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "whatsapp_bot_connection_tenant_status_idx" ON "whatsapp_bot_connection" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "whatsapp_bot_message_tenant_received_idx" ON "whatsapp_bot_message" ("tenant_id","received_at");--> statement-breakpoint
CREATE INDEX "whatsapp_bot_request_tenant_status_idx" ON "whatsapp_bot_request" ("tenant_id","status");--> statement-breakpoint
ALTER TABLE "academic_operation_preview" ADD CONSTRAINT "academic_operation_preview_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "academic_operation_preview" ADD CONSTRAINT "academic_preview_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "academic_semester" ADD CONSTRAINT "academic_semester_tenant_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "academic_year" ADD CONSTRAINT "academic_year_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "academic_year_history" ADD CONSTRAINT "academic_year_history_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "academic_year_history" ADD CONSTRAINT "academic_year_history_tenant_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_advisor" ADD CONSTRAINT "activity_advisor_group_fkey" FOREIGN KEY ("tenant_id","group_id") REFERENCES "activity_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_advisor" ADD CONSTRAINT "activity_advisor_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_extracurricular_fkey" FOREIGN KEY ("tenant_id","extracurricular_id") REFERENCES "extracurricular"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_group_fkey" FOREIGN KEY ("tenant_id","group_id") REFERENCES "activity_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_group" ADD CONSTRAINT "activity_group_extracurricular_fkey" FOREIGN KEY ("tenant_id","extracurricular_id") REFERENCES "extracurricular"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_group" ADD CONSTRAINT "activity_group_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_group" ADD CONSTRAINT "activity_group_location_fkey" FOREIGN KEY ("tenant_id","location_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_participant" ADD CONSTRAINT "activity_participant_group_fkey" FOREIGN KEY ("tenant_id","group_id") REFERENCES "activity_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_participant" ADD CONSTRAINT "activity_participant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "activity_participant" ADD CONSTRAINT "activity_participant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "applicant_school_binding" ADD CONSTRAINT "applicant_school_binding_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_tenant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_tenant_actor_fkey" FOREIGN KEY ("tenant_id","recorded_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_tenant_session_fkey" FOREIGN KEY ("tenant_id","session_id") REFERENCES "attendance_session"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_tenant_actor_fkey" FOREIGN KEY ("tenant_id","opened_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_group" ADD CONSTRAINT "class_group_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "class_group" ADD CONSTRAINT "class_group_tenant_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_group" ADD CONSTRAINT "class_group_tenant_location_fkey" FOREIGN KEY ("tenant_id","primary_location_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_group_history" ADD CONSTRAINT "class_group_history_tenant_group_fkey" FOREIGN KEY ("tenant_id","class_group_id") REFERENCES "class_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_group_history" ADD CONSTRAINT "class_group_history_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_group_relationship" ADD CONSTRAINT "class_group_relationship_tenant_group_fkey" FOREIGN KEY ("tenant_id","class_group_id") REFERENCES "class_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_membership" ADD CONSTRAINT "class_membership_tenant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_membership" ADD CONSTRAINT "class_membership_tenant_group_fkey" FOREIGN KEY ("tenant_id","class_group_id") REFERENCES "class_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_membership" ADD CONSTRAINT "class_membership_tenant_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_membership" ADD CONSTRAINT "class_membership_tenant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "class_relationship_event" ADD CONSTRAINT "class_relationship_event_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "extracurricular" ADD CONSTRAINT "extracurricular_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "extracurricular" ADD CONSTRAINT "extracurricular_location_fkey" FOREIGN KEY ("tenant_id","default_location_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "headmaster_assignment" ADD CONSTRAINT "headmaster_assignment_tenant_teacher_fkey" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "teacher_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "headmaster_assignment" ADD CONSTRAINT "headmaster_assignment_tenant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "headmaster_assignment_audit" ADD CONSTRAINT "headmaster_audit_tenant_assignment_fkey" FOREIGN KEY ("tenant_id","assignment_id") REFERENCES "headmaster_assignment"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "headmaster_assignment_audit" ADD CONSTRAINT "headmaster_audit_tenant_previous_fkey" FOREIGN KEY ("tenant_id","previous_assignment_id") REFERENCES "headmaster_assignment"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "headmaster_assignment_audit" ADD CONSTRAINT "headmaster_audit_tenant_teacher_fkey" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "teacher_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "headmaster_assignment_audit" ADD CONSTRAINT "headmaster_audit_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "homeroom_assignment" ADD CONSTRAINT "homeroom_tenant_teacher_fkey" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "teacher_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "homeroom_assignment" ADD CONSTRAINT "homeroom_tenant_group_fkey" FOREIGN KEY ("tenant_id","class_group_id") REFERENCES "class_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "homeroom_assignment" ADD CONSTRAINT "homeroom_tenant_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "homeroom_assignment" ADD CONSTRAINT "homeroom_tenant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "inventory_asset" ADD CONSTRAINT "inventory_asset_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "inventory_asset" ADD CONSTRAINT "inventory_asset_tenant_location_fkey" FOREIGN KEY ("tenant_id","location_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "inventory_asset_history" ADD CONSTRAINT "inventory_history_tenant_asset_fkey" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "inventory_asset"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "inventory_asset_history" ADD CONSTRAINT "inventory_history_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "inventory_asset_reference" ADD CONSTRAINT "inventory_reference_tenant_asset_fkey" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "inventory_asset"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_tenant_parent_fkey" FOREIGN KEY ("tenant_id","parent_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_tenant_location_fkey" FOREIGN KEY ("tenant_id","location_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "location_reference" ADD CONSTRAINT "location_reference_tenant_location_fkey" FOREIGN KEY ("tenant_id","location_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_event" ADD CONSTRAINT "organization_event_organization_fkey" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "student_organization"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_event" ADD CONSTRAINT "organization_event_period_fkey" FOREIGN KEY ("tenant_id","period_id") REFERENCES "organization_period"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_event" ADD CONSTRAINT "organization_event_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_leadership" ADD CONSTRAINT "organization_leadership_period_fkey" FOREIGN KEY ("tenant_id","period_id") REFERENCES "organization_period"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_leadership" ADD CONSTRAINT "organization_leadership_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_leadership" ADD CONSTRAINT "organization_leadership_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_organization_fkey" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "student_organization"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "organization_period" ADD CONSTRAINT "organization_period_organization_fkey" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "student_organization"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "ppdb_session" ADD CONSTRAINT "ppdb_session_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "ppdb_session" ADD CONSTRAINT "ppdb_session_tenant_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "ppdb_submission" ADD CONSTRAINT "ppdb_submission_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "ppdb_submission" ADD CONSTRAINT "ppdb_submission_tenant_session_fkey" FOREIGN KEY ("tenant_id","session_id") REFERENCES "ppdb_session"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "ppdb_submission_document" ADD CONSTRAINT "ppdb_submission_document_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "ppdb_submission_document" ADD CONSTRAINT "ppdb_submission_document_submission_fkey" FOREIGN KEY ("tenant_id","submission_id") REFERENCES "ppdb_submission"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "provider_admin" ADD CONSTRAINT "provider_admin_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_tenant_sheet_fkey" FOREIGN KEY ("tenant_id","answer_sheet_id") REFERENCES "quiz_answer_sheet"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_tenant_question_fkey" FOREIGN KEY ("tenant_id","question_id") REFERENCES "quiz_question"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_answer_sheet" ADD CONSTRAINT "quiz_answer_sheet_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "quiz_answer_sheet" ADD CONSTRAINT "quiz_answer_sheet_tenant_session_fkey" FOREIGN KEY ("tenant_id","session_id") REFERENCES "quiz_session"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_answer_sheet" ADD CONSTRAINT "quiz_answer_sheet_tenant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_attendance" ADD CONSTRAINT "quiz_attendance_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "quiz_attendance" ADD CONSTRAINT "quiz_attendance_tenant_session_fkey" FOREIGN KEY ("tenant_id","session_id") REFERENCES "quiz_session"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_attendance" ADD CONSTRAINT "quiz_attendance_tenant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_tenant_session_fkey" FOREIGN KEY ("tenant_id","session_id") REFERENCES "quiz_session"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_session" ADD CONSTRAINT "quiz_session_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "quiz_session" ADD CONSTRAINT "quiz_session_tenant_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_session" ADD CONSTRAINT "quiz_session_tenant_subject_fkey" FOREIGN KEY ("tenant_id","subject_id") REFERENCES "subject"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "quiz_session" ADD CONSTRAINT "quiz_session_tenant_class_group_fkey" FOREIGN KEY ("tenant_id","class_group_id") REFERENCES "class_group"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_accreditation" ADD CONSTRAINT "school_accreditation_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "school_accreditation" ADD CONSTRAINT "school_accreditation_profile_id_school_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "school_profile"("id");--> statement-breakpoint
ALTER TABLE "school_accreditation" ADD CONSTRAINT "school_accreditation_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "school_accreditation" ADD CONSTRAINT "school_accreditation_tenant_profile_fkey" FOREIGN KEY ("tenant_id","profile_id") REFERENCES "school_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_accreditation" ADD CONSTRAINT "school_accreditation_tenant_supersedes_fkey" FOREIGN KEY ("tenant_id","supersedes_id") REFERENCES "school_accreditation"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_accreditation" ADD CONSTRAINT "school_accreditation_tenant_correction_fkey" FOREIGN KEY ("tenant_id","correction_id") REFERENCES "school_accreditation"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_admin_authority" ADD CONSTRAINT "school_admin_authority_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_admin_proof" ADD CONSTRAINT "school_admin_proof_authority_fkey" FOREIGN KEY ("tenant_id","authority_id") REFERENCES "school_admin_authority"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_asset" ADD CONSTRAINT "school_asset_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "school_asset" ADD CONSTRAINT "school_asset_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "school_person" ADD CONSTRAINT "school_person_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "school_person" ADD CONSTRAINT "school_person_tenant_account_fkey" FOREIGN KEY ("tenant_id","account_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_person_audit" ADD CONSTRAINT "school_person_audit_tenant_person_fkey" FOREIGN KEY ("tenant_id","person_id") REFERENCES "school_person"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_person_audit" ADD CONSTRAINT "school_person_audit_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "school_profile" ADD CONSTRAINT "school_profile_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "school_profile_audit" ADD CONSTRAINT "school_profile_audit_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "school_profile_audit" ADD CONSTRAINT "school_profile_audit_profile_id_school_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "school_profile"("id");--> statement-breakpoint
ALTER TABLE "school_profile_audit" ADD CONSTRAINT "school_profile_audit_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_command_fkey" FOREIGN KEY ("securityContextKind","context_id","command_id") REFERENCES "security_command"("securityContextKind","context_id","id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_tenant_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_provider_actor_fkey" FOREIGN KEY ("actor_provider_user_id") REFERENCES "provider_admin"("user_id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_target_user_fkey" FOREIGN KEY ("tenant_id","target_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_target_role_fkey" FOREIGN KEY ("tenant_id","target_role_id") REFERENCES "tenant_role"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_target_assignment_fkey" FOREIGN KEY ("tenant_id","target_assignment_id") REFERENCES "tenant_role_assignment"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_target_authority_fkey" FOREIGN KEY ("tenant_id","target_school_admin_authority_id") REFERENCES "school_admin_authority"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "security_audit_event" ADD CONSTRAINT "security_audit_event_target_proof_fkey" FOREIGN KEY ("tenant_id","target_school_admin_proof_id") REFERENCES "school_admin_proof"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "security_audit_head" ADD CONSTRAINT "security_audit_head_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "security_command" ADD CONSTRAINT "security_command_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "security_outbox" ADD CONSTRAINT "security_outbox_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "security_outbox" ADD CONSTRAINT "security_outbox_command_fkey" FOREIGN KEY ("securityContextKind","context_id","command_id") REFERENCES "security_command"("securityContextKind","context_id","id");--> statement-breakpoint
ALTER TABLE "security_reconciliation_finding" ADD CONSTRAINT "security_reconciliation_finding_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "security_reconciliation_finding" ADD CONSTRAINT "security_reconciliation_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "simas_application" ADD CONSTRAINT "simas_application_kPermcBK5z7R_fkey" FOREIGN KEY ("decided_by_provider_admin_id") REFERENCES "provider_admin"("user_id");--> statement-breakpoint
ALTER TABLE "simas_application" ADD CONSTRAINT "simas_application_approved_tenant_id_tenant_id_fkey" FOREIGN KEY ("approved_tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "simas_application" ADD CONSTRAINT "simas_application_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "simas_application" ADD CONSTRAINT "simas_application_binding_id_applicant_school_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "applicant_school_binding"("id");--> statement-breakpoint
ALTER TABLE "staff_audit" ADD CONSTRAINT "staff_audit_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "staff_audit" ADD CONSTRAINT "staff_audit_tenant_person_fkey" FOREIGN KEY ("tenant_id","person_id") REFERENCES "school_person"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "staff_audit" ADD CONSTRAINT "staff_audit_tenant_staff_fkey" FOREIGN KEY ("tenant_id","staff_id") REFERENCES "staff_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "staff_position_assignment" ADD CONSTRAINT "staff_position_assignment_tenant_staff_fkey" FOREIGN KEY ("tenant_id","staff_id") REFERENCES "staff_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "staff_position_assignment" ADD CONSTRAINT "staff_position_assignment_tenant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_tenant_person_fkey" FOREIGN KEY ("tenant_id","person_id") REFERENCES "school_person"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "staff_relationship" ADD CONSTRAINT "staff_relationship_tenant_staff_fkey" FOREIGN KEY ("tenant_id","staff_id") REFERENCES "staff_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "staff_service_period" ADD CONSTRAINT "staff_service_period_tenant_staff_fkey" FOREIGN KEY ("tenant_id","staff_id") REFERENCES "staff_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "staff_service_period" ADD CONSTRAINT "staff_service_period_tenant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_audit" ADD CONSTRAINT "student_audit_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "student_audit" ADD CONSTRAINT "student_audit_tenant_person_fkey" FOREIGN KEY ("tenant_id","person_id") REFERENCES "school_person"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_audit" ADD CONSTRAINT "student_audit_tenant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_lifecycle_period" ADD CONSTRAINT "student_lifecycle_period_tenant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_lifecycle_period" ADD CONSTRAINT "student_lifecycle_period_tenant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_organization" ADD CONSTRAINT "student_organization_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "student_organization" ADD CONSTRAINT "student_organization_location_fkey" FOREIGN KEY ("tenant_id","secretariat_location_id") REFERENCES "location"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_tenant_person_fkey" FOREIGN KEY ("tenant_id","person_id") REFERENCES "school_person"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_relationship" ADD CONSTRAINT "student_relationship_tenant_student_fkey" FOREIGN KEY ("tenant_id","student_id") REFERENCES "student_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "subject_history" ADD CONSTRAINT "subject_history_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "subject_history" ADD CONSTRAINT "subject_history_tenant_subject_fkey" FOREIGN KEY ("tenant_id","subject_id") REFERENCES "subject"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teacher_audit" ADD CONSTRAINT "teacher_audit_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "teacher_audit" ADD CONSTRAINT "teacher_audit_tenant_person_fkey" FOREIGN KEY ("tenant_id","person_id") REFERENCES "school_person"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teacher_audit" ADD CONSTRAINT "teacher_audit_tenant_teacher_fkey" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "teacher_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_tenant_person_fkey" FOREIGN KEY ("tenant_id","person_id") REFERENCES "school_person"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teacher_relationship" ADD CONSTRAINT "teacher_relationship_tenant_teacher_fkey" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "teacher_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teacher_service_period" ADD CONSTRAINT "teacher_service_period_tenant_teacher_fkey" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "teacher_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teacher_service_period" ADD CONSTRAINT "teacher_service_period_tenant_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_teacher_fkey" FOREIGN KEY ("tenant_id","teacher_profile_id") REFERENCES "teacher_profile"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_subject_fkey" FOREIGN KEY ("tenant_id","subject_id") REFERENCES "subject"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_class_group_fkey" FOREIGN KEY ("tenant_id","class_group_id","academic_year_id") REFERENCES "class_group"("tenant_id","id","academic_year_id");--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_academic_year_fkey" FOREIGN KEY ("tenant_id","academic_year_id") REFERENCES "academic_year"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_actor_fkey" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teaching_assignment_event" ADD CONSTRAINT "teaching_assignment_event_assignment_fkey" FOREIGN KEY ("tenant_id","teaching_assignment_id") REFERENCES "teaching_assignment"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teaching_assignment_event" ADD CONSTRAINT "teaching_assignment_event_replacement_fkey" FOREIGN KEY ("tenant_id","replacement_assignment_id") REFERENCES "teaching_assignment"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "teaching_assignment_event" ADD CONSTRAINT "teaching_assignment_event_actor_fkey" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "temporary_credential_activation" ADD CONSTRAINT "temporary_credential_activation_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "temporary_credential_activation" ADD CONSTRAINT "temporary_credential_activation_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_source_application_id_simas_application_id_fkey" FOREIGN KEY ("source_application_id") REFERENCES "simas_application"("id");--> statement-breakpoint
ALTER TABLE "tenant_account_lifecycle_case" ADD CONSTRAINT "tenant_account_case_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_account_security" ADD CONSTRAINT "tenant_account_security_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_openwa_credential" ADD CONSTRAINT "tenant_openwa_credential_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "tenant_rbac_rollout" ADD CONSTRAINT "tenant_rbac_rollout_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "tenant_role" ADD CONSTRAINT "tenant_role_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "tenant_role" ADD CONSTRAINT "tenant_role_tenant_copy_fkey" FOREIGN KEY ("tenant_id","copied_from_role_id") REFERENCES "tenant_role"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_role_assignment" ADD CONSTRAINT "tenant_role_assignment_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "user"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_role_assignment" ADD CONSTRAINT "tenant_role_assignment_role_fkey" FOREIGN KEY ("tenant_id","role_id") REFERENCES "tenant_role"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_role_menu_visibility" ADD CONSTRAINT "tenant_role_menu_visibility_role_fkey" FOREIGN KEY ("tenant_id","role_id") REFERENCES "tenant_role"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_role_permission" ADD CONSTRAINT "tenant_role_permission_role_fkey" FOREIGN KEY ("tenant_id","role_id") REFERENCES "tenant_role"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "whatsapp_bot_connection" ADD CONSTRAINT "whatsapp_bot_connection_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "whatsapp_bot_request" ADD CONSTRAINT "whatsapp_bot_request_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");