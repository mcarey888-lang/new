import { Redirect, type Href } from "expo-router";
import React, { useEffect } from "react";

import { useApp } from "@/context/AppContext";

export function LegacyExpeditionRedirect({ href }: { href: Href }) {
  const { isLoading, shellMode, setShellMode } = useApp();

  useEffect(() => {
    if (!isLoading && shellMode !== "expedition") {
      void setShellMode("expedition");
    }
  }, [isLoading, shellMode, setShellMode]);

  if (isLoading || shellMode !== "expedition") return null;
  return <Redirect href={href} />;
}