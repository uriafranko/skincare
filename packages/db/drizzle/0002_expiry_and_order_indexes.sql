DROP INDEX "one_off_reminders_user_id_idx";--> statement-breakpoint
DROP INDEX "products_user_id_idx";--> statement-breakpoint
CREATE INDEX "expiring_keys_expires_at_idx" ON "expiring_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "export_blobs_expires_at_idx" ON "export_blobs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "onboarding_states_expires_at_idx" ON "onboarding_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "one_off_reminders_user_send_at_idx" ON "one_off_reminders" USING btree ("user_id","send_at");--> statement-breakpoint
CREATE INDEX "phone_mappings_user_id_idx" ON "phone_mappings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "products_user_created_at_idx" ON "products" USING btree ("user_id","created_at");