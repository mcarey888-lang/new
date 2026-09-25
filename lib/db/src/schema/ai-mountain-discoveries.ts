import { pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const aiMountainDiscoveries = pgTable(
  "ai_mountain_discoveries",
  {
    id: text("id").primaryKey(),
    identityKey: text("identity_key").notNull(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    region: text("region").notNull(),
    area: text("area"),
    elevationM: real("elevation_m"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    originalQuery: text("original_query").notNull(),
    provenance: text("provenance").notNull(),
    verificationStatus: text("verification_status").notNull().default("ai_unverified"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("ai_mountain_discoveries_identity_key_uq").on(table.identityKey)],
);

export type AiMountainDiscovery = typeof aiMountainDiscoveries.$inferSelect;
export type InsertAiMountainDiscovery = typeof aiMountainDiscoveries.$inferInsert;