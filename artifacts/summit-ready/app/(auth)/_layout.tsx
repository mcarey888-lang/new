import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { T } from "@/constants/theme";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={T.green} />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
