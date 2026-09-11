import React, { createContext, useContext, useMemo, useState } from "react";

export type DemoPath = "mountain" | "challenge";
type DemoState = { path: DemoPath | null; setPath: (path: DemoPath) => void };
const Context = createContext<DemoState | null>(null);

export function TrainingDemoProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState<DemoPath | null>(null);
  const value = useMemo(() => ({ path, setPath }), [path]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTrainingDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("TrainingDemoProvider is missing");
  return value;
}