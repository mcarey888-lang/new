import { pgTable, text, timestamp, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { recordedHikeBackups } from "./recorded-hike-backups";

export const activityPreferences = pgTable("activity_preferences", {
  owner: text("owner").primaryKey(),
  audience: text("audience", { enum: ["public", "followers", "private"] }),
  coverPath: text("cover_path"),
});
export const activityFollows = pgTable("activity_follows", {
  follower: text("follower").notNull(),
  followed: text("followed").notNull(),
}, t => [primaryKey({ columns: [t.follower, t.followed] })]);
export const activityPublications = pgTable("activity_publications", {
  owner: text("owner").notNull(),
  hikeId: text("hike_id").notNull(),
  audience: text("audience", { enum: ["public", "followers", "private"] }).notNull(),
  audienceRevision: text("audience_revision").notNull().default("1970-01-01T00:00:00.000Z"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  primaryKey({ columns: [t.owner, t.hikeId] }),
  foreignKey({ columns: [t.owner, t.hikeId], foreignColumns: [recordedHikeBackups.ownerUserId, recordedHikeBackups.hikeId] }).onDelete("cascade"),
]);
export const activityBookmarks = pgTable("activity_bookmarks", {
  viewer: text("viewer").notNull(),
  owner: text("owner").notNull(),
  hikeId: text("hike_id").notNull(),
}, t => [primaryKey({ columns: [t.viewer, t.owner, t.hikeId] })]);
export const activityRouteReports = pgTable("activity_route_reports", {
  reporter: text("reporter").notNull(),
  owner: text("owner").notNull(),
  hikeId: text("hike_id").notNull(),
  reason: text("reason").notNull(),
}, t => [primaryKey({ columns: [t.reporter, t.owner, t.hikeId] })]);
export const activityTrailSuggestions = pgTable("activity_trail_suggestions", {
  owner: text("owner").notNull(),
  hikeId: text("hike_id").notNull(),
  evidenceRevision: text("evidence_revision").notNull(),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, t => [primaryKey({ columns: [t.owner, t.hikeId] })]);
