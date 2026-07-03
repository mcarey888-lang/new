import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // Only redirect once we know for certain the user is signed in.
  // Never block rendering on isLoaded — doing so causes an indefinite
  // green spinner whenever Clerk initialises slowly (e.g. stale token).
  if (isLoaded && isSignedIn) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
