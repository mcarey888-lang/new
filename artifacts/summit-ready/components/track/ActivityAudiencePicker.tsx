import React from "react";
import { View, Text, Pressable } from "react-native";
import { ACTIVITY_AUDIENCES, type ActivityAudience } from "@/utils/activityAudience";
import { BASECAMP } from "@/constants/tokens";
export function ActivityAudiencePicker({ audience, onChange, error }: {
  audience: ActivityAudience | null; onChange: (audience: ActivityAudience) => void; error?: string | null;
}) {
  return <View style={{ padding: 14, gap: 10 }}>
    <Text style={{ color: BASECAMP.textStrong, fontSize: 16 }}>Who can see this recording?</Text>
    <Text style={{ color: BASECAMP.textMuted }}>Public means signed-in SummitReady members. Sharing includes your recorded route and start/end locations. Followers only is checked by the server.</Text>
    <Text style={{color:BASECAMP.textMuted,fontSize:12}}>Changes to an already shared route take effect after successful sync. Offline, its previous audience remains in force.</Text>
    {ACTIVITY_AUDIENCES.map(option => <Pressable key={option.value} accessibilityRole="radio"
      accessibilityState={{ checked: audience === option.value }} accessibilityLabel={option.label}
      onPress={() => onChange(option.value)}
      style={{ minHeight: 48, justifyContent: "center", padding: 12, borderWidth: 1,
        borderColor: audience === option.value ? BASECAMP.accent : BASECAMP.panelBorder, borderRadius: 8 }}>
      <Text style={{ color: audience === option.value ? BASECAMP.accent : BASECAMP.textStrong }}>{option.label}</Text>
    </Pressable>)}
    {!audience ? <Text style={{ color: BASECAMP.textMuted }}>Choose once before saving. Your choice becomes the default for new recordings; old activities are not changed.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: BASECAMP.textStrong }}>{error}</Text> : null}
  </View>;
}
