import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { useApp } from "@/context/AppContext";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { shellMode, isLoading, activeExpeditionId } = useApp();

  // Only redirect once we know for certain the user is signed in.
  // Never block rendering on isLoaded — doing so causes an indefinite
  // green spinner whenever Clerk initialises slowly (e.g. stale token).
  if (isLoaded && isSignedIn && !isLoading) {
    const destination = shellMode === "expedition"
      ? activeExpeditionId
        ? "/(expedition)/base-camp"
        : "/(expedition)/mountains"
      : "/(tabs)/dashboard";
    return <Redirect href={destination} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
