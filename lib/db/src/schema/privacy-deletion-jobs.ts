import { pgTable, text, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
/** Restricted erasure ledger, deliberately independent of the deleted account.
 * Contains no activity content. Needed to retry failures and follow up providers. */
export const privacyDeletionJobs = pgTable("privacy_deletion_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  state: jsonb("state").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
