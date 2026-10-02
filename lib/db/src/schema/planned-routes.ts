import { pgTable, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A route somebody drew for themselves.
 *
 * Kept apart from `trackedRoutes` and from the canonical route pipeline
 * because it is a different kind of thing. A tracked route was recorded by
 * walking. A canonical route has been rights-cleared and validated against
 * evidence. A plan is a line on a map, possibly crossing ground nobody has
 * surveyed — and it must never be read as either of the others.
 */
export const plannedRoutes = pgTable("planned_routes", {
  id:            text("id").primaryKey(),
  /** Clerk userId. A plan belongs to one person and is not published. */
  userId:        text("user_id").notNull(),
  name:          text("name").notNull(),
  /** Which summit this route climbs, by slug. Null when it is not about one —
   *  a valley walk or a training loop. Slug rather than an id, and with no
   *  foreign key, because summits live in more than one table here and both
   *  key on slug; pointing at the wrong one would reject most of them. */
  hillSlug:      text("hill_slug"),

  /** The taps, so a route can be reopened and edited rather than redrawn. */
  anchors:       jsonb("anchors").notNull(),
  /** Every coordinate of the rendered line, snapped sections expanded. */
  geometry:      jsonb("geometry").notNull(),
  /** Per leg: routed, gap, or straight. What stops a part-snapped route
   *  reading as fully surveyed. */
  legs:          jsonb("legs").notNull().default([]),

  lengthM:       integer("length_m").notNull(),
  /** Nullable, and no default. Unknown ascent is not zero ascent — a route
   *  whose heights could not be read must not claim to be flat. */
  ascentM:       integer("ascent_m"),
  descentM:      integer("descent_m"),
  profile:       jsonb("profile"),

  /** True only when every leg followed a mapped path. */
  fullySnapped:  boolean("fully_snapped").notNull().default(false),

  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("planned_routes_user_idx").on(t.userId, t.updatedAt),
  index("planned_routes_hill_idx").on(t.hillSlug),
]);

export const insertPlannedRouteSchema = createInsertSchema(plannedRoutes).omit({
  createdAt: true,
  updatedAt: true,
});

export type PlannedRoute       = typeof plannedRoutes.$inferSelect;
export type InsertPlannedRoute = z.infer<typeof insertPlannedRouteSchema>;
