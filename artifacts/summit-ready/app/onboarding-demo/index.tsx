import React from "react";
import { DemoScreen, Choice } from "@/components/onboarding-demo/UI";
import { DEMO_PATHS } from "@/components/onboarding-demo/constants";
import { useTrainingDemo } from "@/components/onboarding-demo/TrainingDemoContext";
export default function OnboardingDemo() {
  const { setPath } = useTrainingDemo();
  return <DemoScreen title="What are you training for?" body="Build a plan that fits your life and gets you ready for the trail.">
    <Choice label={DEMO_PATHS.mountain} href="/onboarding-demo/training-pitch" onPress={() => { setPath("mountain"); }} />
    <Choice label={DEMO_PATHS.challenge} href="/onboarding-demo/training-assessment" onPress={() => { setPath("challenge"); }} />
  </DemoScreen>;
}