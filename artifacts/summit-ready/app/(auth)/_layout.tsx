import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { useApp } from "@/context/AppContext";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isLoading } = useApp();

  // Only redirect once we know for certain the user is signed in.
  // Never block rendering on isLoaded — doing so causes an indefinite
  // green spinner whenever Clerk initialises slowly (e.g. stale token).
  if (isLoaded && isSignedIn && !isLoading) {
    // The index route consumes any one-shot onboarding continuation before
    // applying the ordinary signed-in landing destination.
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
