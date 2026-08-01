import {
  pgTable,
  serial,
  text,
  integer,
  smallint,
  real,
  boolean,
  timestamp,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Signature Challenges ─────────────────────────────────────────────────────
// One curated UK challenge per target mountain (or per regional variant).
// Replaces AI-generated repetitive hill selections with curated adventures.
export const signatureChallenges = pgTable("signature_challenges", {
  id:                 serial("id").primaryKey(),
  challengeId:        text("challenge_id").notNull().unique(),       // e.g. "SIG024"
  challengeName:      text("challenge_name").notNull(),              // e.g. "Matterhorn Ridge Challenge"
  targetMountainName: text("target_mountain_name").notNull(),        // raw name from library
  mountainSlug:       text("mountain_slug"),                         // normalised slug (no prefix), soft-linked
  targetRoute:        text("target_route"),                          // e.g. "Hörnligrat (Normal Route)"
  recommendedDays:    smallint("recommended_days").notNull().default(2),
  dnaMatchScore:      real("dna_match_score"),                       // 0–100
  adventureScore:     real("adventure_score"),                       // 0–100
  totalAscentM:       integer("total_ascent_m"),
  totalDistanceKm:    real("total_distance_km"),
  estimatedHours:     real("estimated_hours"),
  difficulty:         text("difficulty"),
  routeDnaFocus:      text("route_dna_focus"),
  summary:            text("summary"),
  regions:            text("regions"),
  featured:           boolean("featured").notNull().default(false),
  dataConfidence:     text("data_confidence").notNull().default("Curated"),
  status:             text("status").notNull().default("active"),

  // ── AI Artwork fields ──────────────────────────────────────────────────────
  heroImage:          text("hero_image"),                            // serving path for 16:9 hero crop
  cardImage:          text("card_image"),                            // serving path for 4:5 card crop
  thumbnailImage:     text("thumbnail_image"),                       // serving path for 1:1 thumbnail
  imagePrompt:        text("image_prompt"),                          // auto-built prompt that was sent to AI
  imageVersion:       smallint("image_version").default(0),          // increments on each regeneration
  imageStatus:        text("image_status").default("pending"),       // pending|generating|generated|approved|rejected|failed
  approved:           boolean("approved").default(false),            // admin-approved for live use
  generatedAt:        timestamp("generated_at", { withTimezone: true }),
  provider:           text("provider"),                              // e.g. "openai-gpt-image-1"
  generationCost:     real("generation_cost"),                       // USD, from API usage
  lastGenerated:      timestamp("last_generated", { withTimezone: true }),

  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("chk_sig_challenges_status", sql`${t.status} IN ('active','draft','hidden')`),
  check("chk_sig_challenges_dna",    sql`${t.dnaMatchScore}  IS NULL OR (${t.dnaMatchScore}  BETWEEN 0 AND 100)`),
  check("chk_sig_challenges_adv",    sql`${t.adventureScore} IS NULL OR (${t.adventureScore} BETWEEN 0 AND 100)`),
  check("chk_sig_challenges_img_status", sql`${t.imageStatus} IN ('pending','generating','generated','approved','rejected','failed')`),
]);

// ── Challenge Stages ─────────────────────────────────────────────────────────
// Ordered daily routes that make up a Signature Challenge.
export const challengeStages = pgTable("challenge_stages", {
  id:            serial("id").primaryKey(),
  challengeId:   text("challenge_id").notNull().references(() => signatureChallenges.challengeId, { onDelete: "cascade" }),
  stageOrder:    smallint("stage_order").notNull(),                  // 1-based day number
  routeKey:      text("route_key"),                                  // normalised route identifier
  routeName:     text("route_name").notNull(),
  region:        text("region"),
  distanceKm:    real("distance_km"),
  ascentM:       real("ascent_m"),
  estimatedHours: real("estimated_hours"),
  difficulty:    text("difficulty"),
  dnaContribution: text("dna_contribution"),                         // pipe-separated DNA traits
  whySelected:   text("why_selected"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_challenge_stages_order_uniq").on(t.challengeId, t.stageOrder),
]);

// ── Challenge Limitations ────────────────────────────────────────────────────
// Each limitation is one sentence (altitude, glacier, snow, technical gaps).
export const challengeLimitations = pgTable("challenge_limitations", {
  id:          serial("id").primaryKey(),
  challengeId: text("challenge_id").notNull().references(() => signatureChallenges.challengeId, { onDelete: "cascade" }),
  limitation:  text("limitation").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Type exports ──────────────────────────────────────────────────────────────
export type SignatureChallenge       = typeof signatureChallenges.$inferSelect;
export type InsertSignatureChallenge = typeof signatureChallenges.$inferInsert;
export type ChallengeStage           = typeof challengeStages.$inferSelect;
export type InsertChallengeStage     = typeof challengeStages.$inferInsert;
export type ChallengeLimitation      = typeof challengeLimitations.$inferSelect;
export type InsertChallengeLimitation = typeof challengeLimitations.$inferInsert;
