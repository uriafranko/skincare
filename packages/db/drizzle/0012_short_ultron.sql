-- Pre-launch reset: production has no users, so no legacy personalization backfill is required.
DROP TABLE "products" CASCADE;--> statement-breakpoint
DROP TABLE "routine_experiments" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "skin_type";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "sensitivity";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "concerns";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "goals";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "allergies";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "current_products";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "routine_preference";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "communication_style";
