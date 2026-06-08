import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull().unique(),
    name: text("name").notNull(),
    locale: text("locale").notNull(),
    timezone: text("timezone").notNull(),
    country: text("country").notNull(),
    skinType: text("skin_type").notNull(),
    sensitivity: text("sensitivity").notNull(),
    concerns: text("concerns").notNull(),
    goals: text("goals").notNull(),
    allergies: text("allergies").notNull(),
    currentProducts: text("current_products").notNull(),
    routinePreference: text("routine_preference").notNull(),
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

export const memories = pgTable(
  "memories",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    index("memories_user_id_idx").on(table.userId),
  ],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageIndex: integer("message_index").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.messageIndex] }),
    index("conversation_messages_user_index_idx").on(table.userId, table.messageIndex),
  ],
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

export const onboardingStates = pgTable(
  "onboarding_states",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
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
