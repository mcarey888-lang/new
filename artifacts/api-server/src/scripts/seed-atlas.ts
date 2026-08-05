/**
 * Atlas Brands & Asset Type Seed
 * Run:
 *   cd artifacts/api-server
 *   npx tsx src/scripts/seed-atlas.ts
 */
import { db, atlasBrands, atlasAssetTypes } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Seeding Atlas brands…");

  await db
    .insert(atlasBrands)
    .values([
      {
        slug: "alliance-installations",
        name: "Alliance Installations",
        styleProfile: {
          environments: ["Urban", "Industrial", "Corporate", "Retail"],
          style: ["Professional", "Bold", "Clean"],
          mood: ["Confident", "Expert", "Trustworthy"],
        },
        styleLock: {
          Lighting: "Bright overcast daylight, even and professional",
          "Colour grading": "Neutral to slightly cool, desaturated background with vibrant brand colours",
          Composition: "Rule-of-thirds, subject slightly left or right of centre",
          Architecture: "Modern commercial and industrial buildings",
          "Camera lens": "24-35mm wide angle, minimal distortion",
          Perspective: "Eye-level or slightly below, looking up at work",
          Mood: "Authoritative, professional, large-scale expertise",
          "Depth of field": "Deep focus, entire scene sharp",
          Contrast: "Moderate, no crushing of shadows",
          "Camera height": "Chest height, occasionally low ground angle",
        },
        active: true,
      },
      {
        slug: "ai-wraps",
        name: "AI Wraps",
        styleProfile: {
          environments: ["Urban", "Street", "Showroom", "Outdoor"],
          style: ["Dynamic", "Vibrant", "Modern"],
          mood: ["Energetic", "Bold", "Eye-catching"],
        },
        styleLock: {
          Lighting: "Golden hour or dramatic directional light, strong shadows",
          "Colour grading": "Warm, high saturation, punchy contrast",
          Composition: "Dynamic diagonal lines, vehicle as hero centrepiece",
          Architecture: "Urban streets, car parks, showrooms",
          "Camera lens": "35-50mm, slight perspective compression",
          Perspective: "Low angle looking up at wrapped vehicle",
          Mood: "High-energy, premium quality, transformation story",
          "Depth of field": "Subject sharp, background bokeh or motion blur",
          Contrast: "High contrast, bold shadows",
          "Camera height": "Low to ground, dramatic angle",
        },
        active: true,
      },
      {
        slug: "vistaluxe",
        name: "Vistaluxe",
        styleProfile: {
          environments: ["Luxury", "Interior", "Architectural", "High-end Retail"],
          style: ["Elegant", "Minimal", "Sophisticated"],
          mood: ["Aspirational", "Refined", "Exclusive"],
        },
        styleLock: {
          Lighting: "Soft diffused natural light, subtle rim lighting, no harsh shadows",
          "Colour grading": "Warm cream tones, slight film grain, muted with luxury warmth",
          Composition: "Symmetrical or golden-ratio, deliberate negative space",
          Architecture: "High-end interior spaces, marble, glass, bespoke fixtures",
          "Camera lens": "50-85mm portrait, flattering compression",
          Perspective: "Eye-level, respectful and intimate",
          Mood: "Calm luxury, quiet confidence, timeless quality",
          "Depth of field": "Shallow to moderate, elegant subject isolation",
          Contrast: "Low contrast, lifted shadows, luminous highlights",
          "Camera height": "Eye-level, occasionally slightly elevated",
        },
        active: true,
      },
      {
        slug: "installa",
        name: "Installa",
        styleProfile: {
          environments: ["Commercial", "Industrial", "Construction", "Infrastructure"],
          style: ["Technical", "Precise", "Professional"],
          mood: ["Reliable", "Skilled", "Efficient"],
        },
        styleLock: {
          Lighting: "Clear daylight or site lighting, practical and functional",
          "Colour grading": "Neutral, slightly desaturated, documentary feel",
          Composition: "Documentation style, show scale of project and crew",
          Architecture: "Construction sites, warehouses, commercial facades, infrastructure",
          "Camera lens": "28-35mm wide, capture environment and context",
          Perspective: "Slightly elevated, show scope of work",
          Mood: "Competent, methodical, serious professional craft",
          "Depth of field": "Deep focus, everything in context",
          Contrast: "Natural, no stylisation",
          "Camera height": "Slightly elevated, overview perspective",
        },
        active: true,
      },
    ])
    .onConflictDoUpdate({
      target: atlasBrands.slug,
      set: {
        name: sql`excluded.name`,
        styleProfile: sql`excluded.style_profile`,
        styleLock: sql`excluded.style_lock`,
        active: sql`excluded.active`,
      },
    });

  console.log("Seeding Atlas asset types…");

  await db
    .insert(atlasAssetTypes)
    .values([
      { slug: "hero-campaign",        name: "Hero Campaign",        cropConfigs: [], sortOrder: 1, active: true },
      { slug: "vehicle-wrap",         name: "Vehicle Wrap",         cropConfigs: [], sortOrder: 2, active: true },
      { slug: "window-graphics",      name: "Window Graphics",      cropConfigs: [], sortOrder: 3, active: true },
      { slug: "signage-installation", name: "Signage Installation", cropConfigs: [], sortOrder: 4, active: true },
      { slug: "social-content",       name: "Social Content",       cropConfigs: [], sortOrder: 5, active: true },
      { slug: "case-study",           name: "Case Study",           cropConfigs: [], sortOrder: 6, active: true },
      { slug: "event-backdrop",       name: "Event Backdrop",       cropConfigs: [], sortOrder: 7, active: true },
      { slug: "mewp-scene",           name: "MEWP Scene",           cropConfigs: [], sortOrder: 8, active: true },
    ])
    .onConflictDoUpdate({
      target: atlasAssetTypes.slug,
      set: {
        name: sql`excluded.name`,
        sortOrder: sql`excluded.sort_order`,
        active: sql`excluded.active`,
      },
    });

  console.log("✓ Atlas seed complete.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
