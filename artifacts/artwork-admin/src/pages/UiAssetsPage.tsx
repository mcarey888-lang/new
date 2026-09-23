import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";
import { UiAssetSystemCatalogue } from "@/components/UiAssetSystemCatalogue";

export default function UiAssetsPage() {
  return (
    <div
      className="flex min-h-screen flex-col bg-background font-sans text-foreground"
      data-testid="page-ui-assets"
    >
      <ArtworkAdminHeader activeSection="ui-assets" />

      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-8 p-4 sm:p-6">
        <div className="flex max-w-4xl flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            UI Asset System
          </h2>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            This is the canonical read-only UI asset catalogue connected to the
            existing Artwork Admin workflow. Copying a prepared prompt supports
            manual curation only: it does not generate, approve, publish, or
            replace artwork, and every future generated candidate starts as
            DRAFT.
          </p>
        </div>

        <UiAssetSystemCatalogue />
      </main>
    </div>
  );
}