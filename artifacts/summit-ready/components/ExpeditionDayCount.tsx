import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { T } from "@/constants/theme";
import { parseExpeditionDayCount } from "@/utils/expeditionDayCount";

export function ExpeditionDayCount({ value, onChange, allowDefault = false, onValidityChange }: {
  value: number | null;
  onChange: (value: number | null) => void;
  allowDefault?: boolean;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => {
    if (value != null) setDraft(String(value));
  }, [value]);
  const invalid = draft.trim().length > 0 && parseExpeditionDayCount(draft) == null;
  useEffect(() => { onValidityChange?.(!invalid); }, [invalid, onValidityChange]);
  return (
    <View style={s.root}>
      <Text style={s.label}>Walking days / stages</Text>
      <TextInput
        value={draft}
        onChangeText={text => { setDraft(text); onChange(parseExpeditionDayCount(text)); }}
        accessibilityLabel="Number of walking days or stages"
        placeholder="Enter any number, e.g. 7, 30 or 90"
        placeholderTextColor={T.textDim}
        keyboardType="number-pad"
        style={s.input}
        testID="expedition-walking-days"
      />
      <Text style={s.hint}>These do not need to be consecutive. Spread your stages over weeks or months, at your own pace.</Text>
      {invalid && <Text accessibilityRole="alert" style={s.error}>Enter a whole number of days, at least 1.</Text>}
      {allowDefault && (
        <TouchableOpacity accessibilityRole="button" onPress={() => { setDraft(""); onChange(null); }}>
          <Text style={s.default}>{value == null && !draft ? "Using mountain default" : "Use mountain default"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { marginTop: 14, gap: 8 },
  label: { color: T.textMuted, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  input: { color: T.text, backgroundColor: T.surface, borderColor: T.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontFamily: "Inter_600SemiBold", fontSize: 14, minHeight: 46 },
  hint: { color: T.textMuted, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  error: { color: T.red, fontFamily: "Inter_400Regular", fontSize: 12 },
  default: { color: T.blue, fontFamily: "Inter_600SemiBold", fontSize: 12, paddingVertical: 8 },
});
