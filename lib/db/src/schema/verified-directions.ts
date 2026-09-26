import { pgTable, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";

/** Only GPS-confirmed destinations are persisted; internet lookup results are not. */
export const verifiedDirections = pgTable("verified_directions", {
  identityKey: text("identity_key").primaryKey(),
  placeId: text("place_id").notNull(),
  label: text("label").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).defaultNow().notNull(),
});