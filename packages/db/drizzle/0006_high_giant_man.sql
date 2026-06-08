DROP INDEX "conversation_messages_user_index_idx";--> statement-breakpoint
ALTER TABLE "conversation_messages" DROP CONSTRAINT "conversation_messages_user_id_message_index_pk";--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD COLUMN "compacted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "conversation_messages_active_user_created_at_idx" ON "conversation_messages" USING btree ("user_id","created_at") WHERE "conversation_messages"."compacted_at" is null;--> statement-breakpoint
ALTER TABLE "conversation_messages" DROP COLUMN "message_index";