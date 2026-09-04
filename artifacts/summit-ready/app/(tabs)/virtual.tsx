import { Redirect } from "expo-router";
import React, { useEffect } from "react";
import { useApp } from "@/context/AppContext";

/** Legacy deep link: expedition discovery now lives in its isolated shell. */
export default function LegacyVirtualRedirect() {
  const { isLoading, shellMode, setShellMode } = useApp();
  useEffect(() => {
    if (!isLoading && shellMode !== "expedition") void setShellMode("expedition");
  }, [isLoading, shellMode, setShellMode]);
  if (isLoading || shellMode !== "expedition") return null;
  return <Redirect href="/(expedition)/mountains" />;
}