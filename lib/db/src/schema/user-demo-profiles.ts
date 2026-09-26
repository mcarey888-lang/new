import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userDemoProfiles = pgTable("user_demo_profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});