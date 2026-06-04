CREATE TABLE "adherence_streaks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current" integer NOT NULL,
	"longest" integer NOT NULL,
	"last_log_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"user_id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_reminder_times" (
	"user_id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expiring_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_blobs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memories_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "onboarding_states" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text,
	"timezone_confirmed" boolean,
	"timezone" text,
	"skin_type" text,
	"sensitivity" text,
	"concerns" text,
	"goals" text,
	"allergies" text,
	"current_products" text,
	"routine_preference" text,
	"morning_reminder" text,
	"evening_reminder" text,
	"consented" boolean,
	"detected_locale" text,
	"last_bot_reply" text,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_off_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"value" text NOT NULL,
	"send_at" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_mappings" (
	"encrypted_phone" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"value" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_run_ids" (
	"user_id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slot" text NOT NULL,
	"steps" text NOT NULL,
	"completed" boolean NOT NULL,
	"reaction" text NOT NULL,
	"notes" text NOT NULL,
	"source" text NOT NULL,
	"timestamp" text NOT NULL,
	"local_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"locale" text NOT NULL,
	"timezone" text NOT NULL,
	"country" text NOT NULL,
	"skin_type" text NOT NULL,
	"sensitivity" text NOT NULL,
	"concerns" text NOT NULL,
	"goals" text NOT NULL,
	"allergies" text NOT NULL,
	"current_products" text NOT NULL,
	"routine_preference" text NOT NULL,
	"onboarding_complete" boolean NOT NULL,
	"consented_at" text,
	"consent_version" text,
	"created_at" text NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE INDEX "memories_user_id_idx" ON "memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "one_off_reminders_user_id_idx" ON "one_off_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "products_user_id_idx" ON "products" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "routine_entries_user_date_idx" ON "routine_entries" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "routine_entries_user_date_time_idx" ON "routine_entries" USING btree ("user_id","local_date","timestamp");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");