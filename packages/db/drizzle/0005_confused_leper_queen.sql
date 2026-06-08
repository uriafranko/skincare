ALTER TABLE "conversation_messages" ADD COLUMN "created_at" timestamp with time zone;--> statement-breakpoint
WITH ordered_messages AS (
	SELECT
		ctid,
		"updated_at" + ((row_number() OVER (PARTITION BY "user_id" ORDER BY "message_index") - 1) * interval '1 millisecond') AS backfilled_created_at
	FROM "conversation_messages"
)
UPDATE "conversation_messages"
SET "created_at" = ordered_messages.backfilled_created_at
FROM ordered_messages
WHERE "conversation_messages".ctid = ordered_messages.ctid;--> statement-breakpoint
ALTER TABLE "conversation_messages" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "conversation_messages" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "conversation_messages_user_created_at_idx" ON "conversation_messages" USING btree ("user_id","created_at");
