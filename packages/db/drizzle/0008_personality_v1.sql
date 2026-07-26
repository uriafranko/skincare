CREATE TABLE "routine_experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"review_at" text,
	"value" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_states" ADD COLUMN "age_band" text;--> statement-breakpoint
ALTER TABLE "onboarding_states" ADD COLUMN "age_eligible" boolean;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age_band" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "communication_style" text DEFAULT 'clear_expert' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "style_offer_state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "photo_retention_consented_at" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "photo_retention_consent_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "photo_retention_offer_shown_at" text;--> statement-breakpoint
ALTER TABLE "routine_experiments" ADD CONSTRAINT "routine_experiments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routine_experiments_user_created_at_idx" ON "routine_experiments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "routine_experiments_user_review_at_idx" ON "routine_experiments" USING btree ("user_id","review_at");--> statement-breakpoint
CREATE UNIQUE INDEX "routine_experiments_one_active_user_idx" ON "routine_experiments" USING btree ("user_id") WHERE "routine_experiments"."status" = 'active';