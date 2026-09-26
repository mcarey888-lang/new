import { check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const communityPosts = pgTable("community_posts", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  kind: text("kind", { enum: ["story", "badge", "photo"] }).notNull(),
  text: text("text").notNull().default(""),
  badgeId: text("badge_id"),
  badgeTitle: text("badge_title"),
  visibility: text("visibility", { enum: ["private", "members"] }).notNull().default("private"),
  photoPath: text("photo_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("community_posts_owner_created_idx").on(table.ownerUserId, table.createdAt),
  index("community_posts_visibility_created_idx").on(table.visibility, table.createdAt),
  check("community_posts_kind_check", sql`${table.kind} in ('story', 'badge', 'photo')`),
  check("community_posts_visibility_check", sql`${table.visibility} in ('private', 'members')`),
]);

export const communityReports = pgTable("community_reports", {
  id: text("id").primaryKey(),
  reporterUserId: text("reporter_user_id").notNull(),
  postId: text("post_id").notNull(),
  targetOwnerUserId: text("target_owner_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("community_reports_reporter_idx").on(table.reporterUserId),
  index("community_reports_target_owner_idx").on(table.targetOwnerUserId),
  index("community_reports_post_idx").on(table.postId),
  uniqueIndex("community_reports_reporter_post_uidx").on(table.reporterUserId, table.postId),
]);