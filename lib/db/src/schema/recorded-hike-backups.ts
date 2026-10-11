import { pgTable, text, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";

/** Private device snapshots, never community routes or qualified elevation. */
export const recordedHikeBackups = pgTable("recorded_hike_backups", {
  ownerUserId: text("owner_user_id").notNull(),
  hikeId: text("hike_id").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  revision: text("revision").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [primaryKey({ columns: [t.ownerUserId, t.hikeId] })]);
