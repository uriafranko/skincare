import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull().unique(),
    name: text("name").notNull(),
    locale: text("locale").notNull(),
    timezone: text("timezone").notNull(),
    timezoneConfirmed: boolean("timezone_confirmed").notNull().default(false),
    country: text("country").notNull(),
    skinType: text("skin_type").notNull(),
    sensitivity: text("sensitivity").notNull(),
    concerns: text("concerns").notNull(),
    goals: text("goals").notNull(),
    allergies: text("allergies").notNull(),
    currentProducts: text("current_products").notNull(),
    routinePreference: text("routine_preference").notNull(),
    communicationStyle: text("communication_style").notNull().default("clear_expert"),
    styleOfferState: text("style_offer_state").notNull().default("pending"),
    photoRetentionConsentedAt: text("photo_retention_consented_at"),
    photoRetentionConsentVersion: text("photo_retention_consent_version"),
    photoRetentionOfferShownAt: text("photo_retention_offer_shown_at"),
    onboardingComplete: boolean("onboarding_complete").notNull(),
    consentedAt: text("consented_at"),
    consentVersion: text("consent_version"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("users_phone_idx").on(table.phone)],
);

export const phoneMappings = pgTable(
  "phone_mappings",
  {
    encryptedPhone: text("encrypted_phone").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("phone_mappings_user_id_idx").on(table.userId)],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("products_user_created_at_idx").on(table.userId, table.createdAt)],
);

export const userImages = pgTable(
  "user_images",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("user_images_user_created_at_idx").on(table.userId, table.createdAt),
    index("user_images_expires_at_idx").on(table.expiresAt),
  ],
);

export const blobDeletionQueue = pgTable(
  "blob_deletion_queue",
  {
    key: text("key").primaryKey(),
    reason: text("reason").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    retryAfter: timestamp("retry_after", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("blob_deletion_queue_retry_after_idx").on(table.retryAfter)],
);

export const onboardingStates = pgTable(
  "onboarding_states",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    ageEligible: boolean("age_eligible"),
    timezoneConfirmed: boolean("timezone_confirmed"),
    timezone: text("timezone"),
    skinType: text("skin_type"),
    sensitivity: text("sensitivity"),
    concerns: text("concerns"),
    goals: text("goals"),
    allergies: text("allergies"),
    currentProducts: text("current_products"),
    routinePreference: text("routine_preference"),
    morningReminder: text("morning_reminder"),
    eveningReminder: text("evening_reminder"),
    consented: boolean("consented"),
    detectedLocale: text("detected_locale"),
    lastBotReply: text("last_bot_reply"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("onboarding_states_expires_at_idx").on(table.expiresAt)],
);

export const routineExperiments = pgTable(
  "routine_experiments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    reviewAt: text("review_at"),
    value: text("value").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("routine_experiments_user_created_at_idx").on(table.userId, table.createdAt),
    index("routine_experiments_user_review_at_idx").on(table.userId, table.reviewAt),
    uniqueIndex("routine_experiments_one_active_user_idx")
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const adherenceStreaks = pgTable("adherence_streaks", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  current: integer("current").notNull(),
  longest: integer("longest").notNull(),
  lastLogDate: text("last_log_date").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const reminderRunIds = pgTable("reminder_run_ids", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const customReminderTimes = pgTable("custom_reminder_times", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const oneOffReminders = pgTable(
  "one_off_reminders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    sendAt: text("send_at").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("one_off_reminders_user_send_at_idx").on(table.userId, table.sendAt)],
);

export const routineEntries = pgTable(
  "routine_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    steps: text("steps").notNull(),
    completed: boolean("completed").notNull(),
    reaction: text("reaction").notNull(),
    notes: text("notes").notNull(),
    source: text("source").notNull(),
    timestamp: text("timestamp").notNull(),
    localDate: text("local_date").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("routine_entries_user_date_idx").on(table.userId, table.localDate),
    index("routine_entries_user_date_time_idx").on(table.userId, table.localDate, table.timestamp),
  ],
);

export const exportBlobs = pgTable(
  "export_blobs",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("export_blobs_expires_at_idx").on(table.expiresAt)],
);

export const expiringKeys = pgTable(
  "expiring_keys",
  {
    key: text("key").primaryKey(),
    kind: text("kind").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("expiring_keys_expires_at_idx").on(table.expiresAt)],
);
