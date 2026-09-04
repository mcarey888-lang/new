import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { useApp } from "@/context/AppContext";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { shellMode, isLoading } = useApp();

  // Only redirect once we know for certain the user is signed in.
  // Never block rendering on isLoaded — doing so causes an indefinite
  // green spinner whenever Clerk initialises slowly (e.g. stale token).
  if (isLoaded && isSignedIn && !isLoading) {
    return <Redirect href={shellMode === "expedition" ? "/(expedition)/base-camp" : "/(tabs)/dashboard"} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
