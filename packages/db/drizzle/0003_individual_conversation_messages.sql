ALTER TABLE "conversation_messages" ADD COLUMN "message_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_messages" ALTER COLUMN "value" TYPE jsonb USING to_jsonb("value");--> statement-breakpoint
ALTER TABLE "conversation_messages" DROP CONSTRAINT "conversation_messages_pkey";--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_user_id_message_index_pk" PRIMARY KEY("user_id","message_index");--> statement-breakpoint
ALTER TABLE "conversation_messages" ALTER COLUMN "message_index" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "conversation_messages_user_index_idx" ON "conversation_messages" USING btree ("user_id","message_index");
