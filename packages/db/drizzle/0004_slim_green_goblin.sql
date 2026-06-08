CREATE TABLE "blob_deletion_queue" (
	"key" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"retry_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_images" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_images" ADD CONSTRAINT "user_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blob_deletion_queue_retry_after_idx" ON "blob_deletion_queue" USING btree ("retry_after");--> statement-breakpoint
CREATE INDEX "user_images_user_created_at_idx" ON "user_images" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_images_expires_at_idx" ON "user_images" USING btree ("expires_at");