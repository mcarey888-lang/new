import { check, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { communityPosts } from "./community";

export const communityLikes = pgTable("community_likes", {
  postId: text("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.postId, table.userId] }),
]);

export const communityComments = pgTable("community_comments", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("community_comments_post_created_idx").on(table.postId, table.createdAt, table.id),
  check("community_comments_text_check", sql`char_length(btrim(${table.text})) between 1 and 600`),
]);
