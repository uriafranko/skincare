ALTER TABLE "reminder_run_ids" ADD COLUMN "deployment_id" text;--> statement-breakpoint
ALTER TABLE "reminder_run_ids" ADD COLUMN "generation" text;--> statement-breakpoint
ALTER TABLE "reminder_run_ids" ADD COLUMN "migration_id" text;--> statement-breakpoint
ALTER TABLE "reminder_run_ids" ADD COLUMN "migration_started_at" timestamp with time zone;