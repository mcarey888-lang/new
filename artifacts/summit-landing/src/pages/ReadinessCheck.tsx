import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { ReadinessScoreBar } from "@/components/ReadinessScoreBar";
import {
  READINESS_MOUNTAINS,
  QUESTIONS,
  STEPS,
  CATEGORY_LABELS,
  type Category,
} from "@/data/readiness";
import { computeReadiness, type Verdict, type ReadinessResult } from "@/hooks/useReadinessScore";

const CATEGORIES: Category[] = [
  "fitness",
  "experience",
  "strength",
  "mindset",
  "health",
];

type VerdictConfig = {
  label: string;
  subLabel: string;
  description: (name: string) => string;
  color: string;
  bg: string;
  border: string;
};

const VERDICT_CONFIG: Record<Verdict, VerdictConfig> = {
  ready: {
    label: "You're ready",
    subLabel: "Your profile matches what this mountain demands",
    description: (m) =>
      `Your fitness, experience, and mindset profile align with what ${m} requires. A structured training block — focused on the gaps below — will get you to the start line confident and prepared.`,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  almost: {
    label: "Almost ready",
    subLabel: "Close — focused preparation will bridge the gap",
    description: (m) =>
      `You have a solid foundation for ${m}. A few key areas need attention, but with a focused 3–4 month training block you'll be well positioned for a genuine attempt.`,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
  },
  training: {
    label: "Training needed",
    subLabel: "Meaningful gaps to close before your attempt",
    description: (m) =>
      `Your current profile shows some gaps for ${m}. The good news: these are all trainable. Follow the priority actions below and reassess in 3–6 months.`,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
  },
  notyet: {
    label: "Not yet",
    subLabel: "Build your base on a stepping-stone peak first",
    description: (m) =>
      `${m} requires a level of fitness, experience, or technical skill that your current profile doesn't yet match. That doesn't mean never — it means starting with a stepping-stone objective and building systematically from there.`,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
  },
};

function formatTrainingTime(weeks: [number, number]): string {
  if (weeks[1] <= 16) return `${weeks[0]}–${weeks[1]} weeks`;
  const lo = Math.round(weeks[0] / 4.3);
  const hi = Math.round(weeks[1] / 4.3);
  return `${lo}–${hi} months`;
}

function ScoreGauge({ score, verdict }: { score: number; verdict: Verdict }) {
  const size = 128;
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const colorMap: Record<Verdict, string> = {
    ready: "#3ecf75",
    almost: "#60a5fa",
    training: "#fb923c",
    notyet: "#f87171",
  };

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={sw}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colorMap[verdict]}
          strokeWidth={sw}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center pointer-events-none">
        <div className="text-4xl font-display font-bold text-white leading-none">
          {score}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

export default function ReadinessCheck() {
  usePageMeta({
    title:
      "Mountain Readiness Assessment — Am I Fit Enough? | SummitReady",
    description:
      "Answer 17 questions and find out if you're ready for Mont Blanc, Kilimanjaro, the Matterhorn, Everest Base Camp, or Gran Paradiso. Free, instant personalised result.",
    canonical: "https://summitready.uk/readiness-check/",
    schema: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Mountain Readiness Assessment",
      description:
        "A free readiness assessment that tells you whether you're ready for your target mountain, what to work on, and how long you need to prepare.",
      url: "https://summitready.uk/readiness-check/",
      applicationCategory: "HealthApplication",
      publisher: {
        "@type": "Organization",
        name: "SummitReady",
        url: "https://summitready.uk/",
      },
    },
  });

  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("mountain") ?? "";

  const [mountainId, setMountainId] = useState(preselect);
  const [step, setStep] = useState(preselect ? 1 : 0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const selectedMountain = READINESS_MOUNTAINS.find((m) => m.id === mountainId);

  const currentStepDef = step >= 1 && step <= 5 ? STEPS[step - 1] : null;
  const currentQuestions = currentStepDef
    ? QUESTIONS.filter((q) => q.category === currentStepDef.category)
    : [];
  const stepComplete =
    currentQuestions.length > 0 &&
    currentQuestions.every((q) => answers[q.id] !== undefined);

  const result: ReadinessResult | null =
    step === 6 && mountainId ? computeReadiness(answers, mountainId) : null;

  function handleAnswer(qId: string, score: number) {
    setAnswers((prev) => ({ ...prev, [qId]: score }));
  }

  function handleNext() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step < 5) setStep(step + 1);
    else setStep(6);
  }

  function handleBack() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === 1) setStep(0);
    else setStep(step - 1);
  }

  function handleRestart() {
    setStep(preselect ? 1 : 0);
    setAnswers({});
    if (!preselect) setMountainId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const vc = result ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <SiteLayout>
      <div className="bg-background min-h-screen">
        {/* Hero */}
        <section className="py-16 md:py-20 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.06),transparent_60%)]" />
          <div className="container mx-auto px-6 max-w-4xl relative">
            <nav
              className="flex items-center gap-2 text-sm text-muted-foreground mb-8"
              aria-label="Breadcrumb"
            >
              <Link to="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Readiness Check</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary mb-6 uppercase tracking-widest">
              <BarChart3 className="w-3 h-3" />
              Free Assessment
            </div>

            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 tracking-tight leading-[1.05]">
              Am I Ready for
              {selectedMountain ? ` ${selectedMountain.name}?` : " My Mountain?"}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Answer 17 questions and get an honest, personalised readiness score
              — including your strengths, gaps, and a recommended training
              timeline.
            </p>
          </div>
        </section>

        {/* Wizard */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-6 max-w-2xl">

            {/* ── Step 0: Mountain picker ── */}
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-2">
                  Pick your target mountain
                </h2>
                <p className="text-muted-foreground text-sm mb-8">
                  Your results will be calibrated to the specific demands of the
                  peak you choose.
                </p>
                <div className="space-y-3">
                  {READINESS_MOUNTAINS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMountainId(m.id);
                        setStep(1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full text-left bg-white/3 border border-white/8 hover:border-primary/40 hover:bg-primary/5 rounded-2xl p-5 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl" aria-hidden="true">
                            {m.emoji}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-white">
                                {m.name}
                              </span>
                              <span
                                className={`text-xs font-semibold ${m.diffColor}`}
                              >
                                {m.difficulty}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {m.elevation}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Steps 1–5: Questions ── */}
            {step >= 1 && step <= 5 && currentStepDef && (
              <div>
                {/* Progress bar */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">
                      {currentStepDef.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Step {step} of 5
                      {selectedMountain ? ` · ${selectedMountain.name}` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${((step - 1) / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Question cards */}
                <div className="space-y-5">
                  {currentQuestions.map((q, qi) => (
                    <div
                      key={q.id}
                      className="bg-white/3 border border-white/8 rounded-2xl p-6"
                    >
                      <p className="font-semibold text-white mb-4 leading-snug">
                        <span className="text-primary/50 text-sm font-normal mr-2">
                          {qi + 1}.
                        </span>
                        {q.text}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const selected = answers[q.id] === opt.score;
                          return (
                            <button
                              key={opt.score}
                              onClick={() => handleAnswer(q.id, opt.score)}
                              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                                selected
                                  ? "border-primary bg-primary/10 text-white font-medium"
                                  : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/25 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              <span className="inline-flex items-center gap-3">
                                <span
                                  className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-all ${
                                    selected
                                      ? "border-primary bg-primary"
                                      : "border-white/25"
                                  }`}
                                  aria-hidden="true"
                                >
                                  {selected && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-background block" />
                                  )}
                                </span>
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="rounded-full border-white/15 text-muted-foreground hover:text-white hover:border-white/30"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!stepComplete}
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold disabled:opacity-30 disabled:cursor-not-allowed px-8"
                  >
                    {step === 5 ? "See my results" : "Next"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 6: Results ── */}
            {step === 6 && result && vc && selectedMountain && (
              <div>
                {/* Verdict banner */}
                <div
                  className={`rounded-2xl border p-6 mb-6 ${vc.bg} ${vc.border}`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ScoreGauge score={result.overall} verdict={result.verdict} />
                    <div className="text-center sm:text-left">
                      <div
                        className={`text-2xl font-display font-bold mb-1 ${vc.color}`}
                      >
                        {vc.label}
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">
                        {vc.subLabel}
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">
                        {vc.description(selectedMountain.name)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Training timeline */}
                <div className="bg-white/3 border border-white/8 rounded-2xl p-5 mb-5 flex items-center gap-4">
                  <Clock className="w-8 h-8 text-primary shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">
                      Recommended preparation window
                    </div>
                    <div className="font-bold text-white text-lg">
                      {formatTrainingTime(result.trainingWeeks)}
                    </div>
                  </div>
                </div>

                {/* Timing warning */}
                {result.timingWarning && (
                  <div className="bg-orange-400/10 border border-orange-400/30 rounded-xl p-4 mb-5 flex gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-200/90 leading-relaxed">
                      {result.timingWarning}
                    </p>
                  </div>
                )}

                {/* Category breakdown */}
                <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-5">
                  <h2 className="font-bold text-white mb-5 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Your profile breakdown
                  </h2>
                  <div className="space-y-4">
                    {CATEGORIES.map((cat) => (
                      <ReadinessScoreBar
                        key={cat}
                        category={cat}
                        score={result.scores[cat]}
                        threshold={
                          cat === "fitness"
                            ? selectedMountain.thresholds.fitness
                            : cat === "experience"
                            ? selectedMountain.thresholds.experience
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    White marker shows the minimum required score for{" "}
                    {selectedMountain.name} where a per-category threshold applies.
                  </p>
                </div>

                {/* Priority actions */}
                {result.priorityActions.length > 0 && (
                  <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-5">
                    <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Priority training actions
                    </h2>
                    <div className="space-y-4">
                      {result.priorityActions.map((action, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <p className="text-sm text-white/80 leading-relaxed">
                            {action}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {result.strengths.length > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-5">
                    <h2 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Strengths to build on
                    </h2>
                    <p className="text-sm text-white/70">
                      {result.strengths.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                    </p>
                  </div>
                )}

                {/* CTA */}
                <div className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
                  <h2 className="text-2xl font-display font-bold text-white mb-3">
                    Start training for {selectedMountain.name}
                  </h2>
                  <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                    Summit Ready builds your personalised training plan based on
                    your summit goal, current fitness, and available preparation
                    time — then adapts week by week as you progress.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a href="/#get-started">
                      <Button
                        size="lg"
                        className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8 h-12 text-sm shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95 w-full sm:w-auto"
                      >
                        Download SummitReady
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </a>
                    {selectedMountain.training && (
                      <Link to={selectedMountain.training}>
                        <Button
                          variant="outline"
                          size="lg"
                          className="rounded-full border-white/15 hover:bg-white/5 hover:border-primary/40 hover:text-primary font-semibold h-12 text-sm w-full sm:w-auto"
                        >
                          View training plan
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Retake */}
                <div className="text-center mt-6">
                  <button
                    onClick={handleRestart}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    ← Start over / choose a different mountain
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
