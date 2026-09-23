import React from "react";
import { Layers, FileImage } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Batch01ReviewGallery, Batch02ReviewGallery } from "@/components/Batch01ReviewGallery";
import { UiAssetSystemCatalogue } from "@/components/UiAssetSystemCatalogue";
import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";

// Direct Vite imports from the inventoried product source roots.
import boxStepUpsImg from "@summit-assets/images/exercise-box-steps.png";
import ellipticalImg from "@summit-assets/images/exercise-elliptical.png";
import outdoorWalkImg from "@summit-assets/images/exercise-outdoor.png";
import stairmasterImg from "@summit-assets/images/exercise-stepper.png";
import inclineTreadmillImg from "@summit-assets/images/exercise-treadmill.png";
import weightedStairsImg from "@summit-assets/images/exercise-weighted-stairs.png";
import basecampHeroImg from "@summit-assets/images/hero-base-camp.png";
import mountainBackgroundImg from "@summit-assets/images/mountain-bg.png";
import mascotImg from "@summit-assets/mascot.webp";
import landingHeroImg from "@landing-assets/hero-bg.jpeg";
import featureClimbImg from "@landing-assets/feature-climb.jpg";
import featureMapImg from "@landing-assets/feature-map.jpg";

type Classification = "KEEP" | "KEEP / REPROCESS" | "LEGACY / UNUSED" | "PROTECTED";

interface AssetDef {
  id: string;
  source: string;
  src: string;
  classification: Classification;
  placement: string;
  dimensions: string;
  isDerivative?: boolean;
}

interface AssetFamily {
  id: string;
  name: string;
  description: string;
  assets: AssetDef[];
}

const ASSET_FAMILIES: AssetFamily[] = [
  {
    id: "fam-exercises",
    name: "Exercise Library",
    description: "Source 3D renders for in-app workout assignments and coaching notes.",
    assets: [
      {
        id: "ex-box-step",
        source: "summit-ready/assets/images/exercise-box-steps.png",
        src: boxStepUpsImg,
        classification: "KEEP / REPROCESS",
        placement: "Mobile: Session Detail (Header)",
        dimensions: "1024x1024 (1:1 Intent)",
      },
      {
        id: "ex-elliptical",
        source: "summit-ready/assets/images/exercise-elliptical.png",
        src: ellipticalImg,
        classification: "KEEP / REPROCESS",
        placement: "Mobile: Session Detail (Header)",
        dimensions: "1024x1024 (1:1 Intent)",
      },
      {
        id: "ex-treadmill",
        source: "summit-ready/assets/images/exercise-treadmill.png",
        src: inclineTreadmillImg,
        classification: "KEEP / REPROCESS",
        placement: "Mobile: Session Detail (Header)",
        dimensions: "1024x1024 (1:1 Intent)",
      },
      {
        id: "ex-outdoor",
        source: "summit-ready/assets/images/exercise-outdoor.png",
        src: outdoorWalkImg,
        classification: "KEEP / REPROCESS",
        placement: "Mobile: Session Detail (Header)",
        dimensions: "1024x1024 (1:1 Intent)",
      },
      {
        id: "ex-stairmaster",
        source: "summit-ready/assets/images/exercise-stepper.png",
        src: stairmasterImg,
        classification: "KEEP / REPROCESS",
        placement: "Mobile: Session Detail (Header)",
        dimensions: "1024x1024 (1:1 Intent)",
      },
      {
        id: "ex-weighted",
        source: "summit-ready/assets/images/exercise-weighted-stairs.png",
        src: weightedStairsImg,
        classification: "KEEP / REPROCESS",
        placement: "Mobile: Session Detail (Header)",
        dimensions: "1024x1024 (1:1 Intent)",
      }
    ]
  },
  {
    id: "fam-mobile-identity",
    name: "Mobile Identity",
    description: "Current bundled identity and atmospheric source assets.",
    assets: [
      {
        id: "mobile-basecamp",
        source: "summit-ready/assets/images/hero-base-camp.png",
        src: basecampHeroImg,
        classification: "KEEP",
        placement: "Mobile: Basecamp",
        dimensions: "Bundled source",
      },
      {
        id: "mobile-mountain-background",
        source: "summit-ready/assets/images/mountain-bg.png",
        src: mountainBackgroundImg,
        classification: "KEEP",
        placement: "Mobile: Atmospheric background",
        dimensions: "Bundled source",
        isDerivative: true,
      },
      {
        id: "mobile-mascot",
        source: "summit-ready/assets/mascot.webp",
        src: mascotImg,
        classification: "KEEP",
        placement: "Mobile: Coach identity",
        dimensions: "Bundled source",
      }
    ]
  },
  {
    id: "fam-marketing",
    name: "Marketing & Landing",
    description: "Landing source assets retained for provenance and derivative planning.",
    assets: [
      {
        id: "landing-hero",
        source: "summit-landing/src/assets/hero-bg.jpeg",
        src: landingHeroImg,
        classification: "KEEP / REPROCESS",
        placement: "Web: Landing hero",
        dimensions: "Original source",
      },
      {
        id: "landing-feature-climb",
        source: "summit-landing/src/assets/feature-climb.jpg",
        src: featureClimbImg,
        classification: "KEEP / REPROCESS",
        placement: "Web: Feature editorial",
        dimensions: "Original source",
      },
      {
        id: "landing-feature-map",
        source: "summit-landing/src/assets/feature-map.jpg",
        src: featureMapImg,
        classification: "KEEP / REPROCESS",
        placement: "Web: Feature editorial",
        dimensions: "Original source",
      },
    ],
  }
];

export default function AssetGallery() {
  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground text-sm">This route is only available in development environments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans" data-testid="page-asset-gallery">
      <ArtworkAdminHeader activeSection="assets" />

      <main className="flex-1 p-6 flex flex-col gap-10 max-w-screen-2xl mx-auto w-full">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight">Existing-Asset Gallery</h2>
          <p className="text-muted-foreground max-w-3xl">
            Internal review surface for inspecting hardcoded SummitReady source assets.
            This view is bounded to development only; Batch 01 and Batch 02 curation persist in isolated review manifests.
          </p>
        </div>

        <div className="flex flex-col gap-12">
          <UiAssetSystemCatalogue />
          <Batch02ReviewGallery />
          <Batch01ReviewGallery />
          {ASSET_FAMILIES.map((family) => (
            <section key={family.id} className="flex flex-col gap-4" data-testid={`section-family-${family.id}`}>
              <div className="border-b border-border pb-3">
                <h3 className="text-xl font-medium text-foreground flex items-center gap-2">
                  <Layers className="w-5 h-5 text-muted-foreground" />
                  {family.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{family.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {family.assets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function AssetCard({ asset }: { asset: AssetDef }) {
  const getBadgeVariant = (classification: Classification) => {
    switch (classification) {
      case "KEEP": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "KEEP / REPROCESS": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "PROTECTED": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "LEGACY / UNUSED": return "bg-gray-500/10 text-gray-400 border-gray-500/20";
      default: return "bg-secondary text-muted-foreground border-border";
    }
  };

  return (
    <div 
      className={`flex flex-col bg-card border ${asset.isDerivative ? "border-dashed border-border/60" : "border-border"} rounded-lg overflow-hidden shadow-sm`}
      data-testid={`card-asset-${asset.id}`}
    >
      <div className="relative group bg-secondary/30 aspect-square flex items-center justify-center p-4">
        {asset.isDerivative && (
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-border text-[10px]">
              DERIVATIVE
            </Badge>
          </div>
        )}
        <div className={`w-full h-full flex items-center justify-center ${asset.isDerivative ? "overflow-hidden" : ""}`}>
          <img 
            src={asset.src} 
            alt={asset.source}
            className={`transition-transform duration-300 group-hover:scale-[1.02] ${asset.isDerivative ? "w-full h-full object-cover" : "max-w-full max-h-full object-contain drop-shadow-md"}`}
          />
        </div>
      </div>
      
      <div className="p-4 flex flex-col gap-4 border-t border-border bg-card/50 flex-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm text-foreground break-all leading-tight flex items-center gap-1.5" title={asset.source}>
              <FileImage className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{asset.source}</span>
            </h4>
          </div>
          <Badge variant="outline" className={`w-fit text-[10px] uppercase font-semibold ${getBadgeVariant(asset.classification)}`}>
            {asset.classification}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 gap-2.5 text-xs text-muted-foreground mt-auto pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground/80 uppercase text-[10px] tracking-wider">Placement</span>
            <span>{asset.placement}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground/80 uppercase text-[10px] tracking-wider">Dimensions</span>
            <span className="font-mono">{asset.dimensions}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
