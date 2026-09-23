import { ExternalLink } from "lucide-react";

const groups = [
  {
    title: "Ranks",
    concepts: [
      { name: "Alpine Ascent", component: "RankAlpineAscent" },
      { name: "Expedition League", component: "RankExpeditionLeague" },
      { name: "Mountain Lineage", component: "RankMountainLineage" },
      { name: "Trail Patches", component: "RankTrailPatches" },
    ],
  },
  {
    title: "Achievements",
    concepts: [
      { name: "Constellation", component: "AchievementConstellation" },
      { name: "Field Journal", component: "AchievementFieldJournal" },
      { name: "Journey Map", component: "AchievementJourneyMap" },
      { name: "Summit Cabinet", component: "AchievementSummitCabinet" },
    ],
  },
  {
    title: "Editorial images",
    concepts: [
      { name: "Cinematic Portrait", component: "EditorialCinematicPortrait" },
      { name: "Documentary Dispatch", component: "EditorialDocumentaryDispatch" },
      { name: "Seasonal Campaign", component: "EditorialSeasonalCampaign" },
      { name: "Topographic Story", component: "EditorialTopographicStory" },
    ],
  },
] as const;

export function UiAssetConcepts() {
  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xl font-semibold">Design concepts · 12 previews</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Four directions each for Ranks, Achievements, and Editorial images. These are snapshots
          of canvas mockups for comparison, not generated artwork, workflow candidates, or approved
          assets. Some concepts use illustrative imagery. Choose a direction before creating
          production artwork through the normal review workflow.
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.title} aria-label={`${group.title} design concepts`} className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h3 className="text-xl font-semibold">{group.title}</h3>
            <span className="text-sm text-muted-foreground">4 directions</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {group.concepts.map((concept) => {
              const snapshot = `${import.meta.env.BASE_URL}concepts/${concept.component}.png`;
              const livePreview = `/__mockup/preview/summitready-explore/${concept.component}`;
              return (
                <article key={concept.component} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <h4 className="font-medium">{concept.name}</h4>
                    <span className="shrink-0 text-xs text-muted-foreground">Mockup</span>
                  </div>
                  <img
                    alt={`${group.title}: ${concept.name} concept preview`}
                    src={snapshot}
                    loading="lazy"
                    className="block aspect-[390/844] w-full border-y border-border bg-background"
                  />
                  <a
                    href={import.meta.env.DEV ? livePreview : snapshot}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {import.meta.env.DEV ? "Open live preview" : "Open full image"}
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}