import { Stack } from "expo-router";
import React from "react";
import { TrainingDemoProvider } from "@/components/onboarding-demo/TrainingDemoContext";
export default function Layout() {
  return <TrainingDemoProvider><Stack screenOptions={{ headerShown: false }} /></TrainingDemoProvider>;
}