import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { ErrorFallbackProps } from "@/components/ErrorFallback";

/**
 * Deliberately has no context or native-provider dependencies.
 *
 * This fallback sits outside ClerkProvider, SafeAreaProvider, and every other
 * app provider so it can still render when one of those providers throws.
 */
export function RootErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const details = [
    `Error: ${error.message || "Unknown JavaScript error"}`,
    error.stack ? `Stack trace:\n${error.stack}` : "Stack trace unavailable",
  ].join("\n\n");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SummitReady encountered an error</Text>
      <Text style={styles.instructions}>
        Please take a screenshot of the details below so we can identify the crash.
      </Text>

      <ScrollView
        style={styles.details}
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator
      >
        <Text selectable style={styles.errorText}>
          {details}
        </Text>
      </ScrollView>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Try loading the app again"
        activeOpacity={0.8}
        onPress={resetError}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 64,
    backgroundColor: "#0B1120",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  instructions: {
    marginTop: 12,
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  details: {
    flex: 1,
    width: "100%",
    marginTop: 20,
    borderColor: "#334155",
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#111827",
  },
  detailsContent: {
    padding: 16,
  },
  errorText: {
    color: "#FCA5A5",
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#2AB860",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});