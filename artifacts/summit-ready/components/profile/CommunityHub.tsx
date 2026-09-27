import { Camera, ChevronDown, Flag, ImagePlus, RefreshCw, Send, Trash2, LockKeyhole, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useState } from "react";
import { Alert, Image, type ImageSourcePropType, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BASECAMP, HIT, SP, TYPE } from "@/constants/tokens";
import { DemoCommunityPreview } from "@/components/profile/DemoCommunityPreview";

export type CommunityPost = {
  id: string;
  kind: "story" | "badge" | "photo";
  text: string;
  badgeId?: string;
  badgeTitle?: string;
  visibility: "private" | "members";
  authorName: string;
  authorAvatarUrl?: string | null;
  ownerUserId: string;
  createdAt: string;
  hasPhoto: boolean;
};

export type CommunityCreate = {
  kind: "story" | "badge" | "photo";
  text: string;
  badgeId?: string;
  badgeTitle?: string;
  photoUri?: string;
  visibility: "private" | "members";
};

export type CommunityHubProps = {
  draftBadge?: { id: string; title: string; nonce: number } | null;
  posts: CommunityPost[];
  minePosts: CommunityPost[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  onRefresh: () => void;
  onCreate: (post: CommunityCreate) => Promise<void> | void;
  onVisibility: (id: string, visibility: "private" | "members") => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onReport: (id: string) => Promise<void> | void;
  photoSource: (post: CommunityPost) => ImageSourcePropType | null;
};

const audienceLabel = (v: "private" | "members") => v === "private" ? "Only me" : "SummitReady members";

export function CommunityHub({ posts, minePosts, loading, error, busy, onRefresh, onCreate, onVisibility, onDelete, onReport, photoSource, draftBadge }: CommunityHubProps) {
  const [view, setView] = useState<"members" | "mine">("members");
  const [composing, setComposing] = useState(false);
  const [kind, setKind] = useState<CommunityCreate["kind"]>("story");
  const [text, setText] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [audience, setAudience] = useState<"private" | "members">("private");
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [visiblePostCount, setVisiblePostCount] = useState(8);
  const notifyError = (message: string) => {
    if (Platform.OS === "web") window.alert(message);
    else Alert.alert("Could not update post", message);
  };
  const executeAction = (action: () => Promise<void> | void) => {
    void Promise.resolve().then(action).catch(() => notifyError("Please try again."));
  };

  useEffect(() => {
    if (!draftBadge) return;
    setKind("badge");
    setText(`I earned ${draftBadge.title} on SummitReady.`);
    setPhotoUri(null);
    setAudience("private");
    setView("mine");
    setComposing(true);
  }, [draftBadge]);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access in Settings to choose a photo. Nothing is uploaded until you post.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      const mime = asset.mimeType?.toLowerCase();
      if (mime && !["image/jpeg", "image/png", "image/webp"].includes(mime)) {
        notifyError("Choose a JPEG, PNG, or WebP photo. HEIC photos must be exported as JPEG before sharing.");
        return;
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        notifyError("This photo is over 5 MB. Crop it or choose a smaller photo.");
        return;
      }
      setPhotoUri(asset.uri);
      setKind("photo");
    }
  };
  const submit = async () => {
    if (busy || submitting || (!text.trim() && !photoUri)) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onCreate({
        kind: photoUri ? "photo" : kind,
        text: text.trim(),
        ...(kind === "badge" && draftBadge && !photoUri ? { badgeId: draftBadge.id, badgeTitle: draftBadge.title } : {}),
        ...(photoUri ? { photoUri } : {}),
        visibility: audience,
      });
      setText("");
      setPhotoUri(null);
      setKind("story");
      setAudience("private");
      setSubmitError(null);
      setComposing(false);
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? error.status : null;
      const message = status === 401 || status === 403
        ? "Your sign-in session could not be verified. Sign out and sign in again, then retry. Your draft is still here."
        : error instanceof Error ? error.message : "Could not post. Your draft is still here.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };
  const confirmDelete = (id: string) => {
    if (Platform.OS === "web") {
      if (window.confirm("Delete this post?")) executeAction(() => onDelete(id));
      return;
    }
    Alert.alert("Delete post?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => executeAction(() => onDelete(id)) },
    ]);
  };
  const confirmReport = (id: string) => {
    if (Platform.OS === "web") {
      if (window.confirm("Report this post for review?")) executeAction(() => onReport(id));
      return;
    }
    Alert.alert("Report post?", "Send this post for review.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report", onPress: () => executeAction(() => onReport(id)) },
    ]);
  };
  const changeAudience = (post: CommunityPost) => {
    const visibility = post.visibility === "private" ? "members" : "private";
    const apply = () => {
      executeAction(() => onVisibility(post.id, visibility));
    };
    if (visibility === "private") { apply(); return; }
    if (Platform.OS === "web") {
      if (window.confirm("Make this post visible to all signed-in SummitReady members?")) apply();
    } else {
      Alert.alert("Share with members?", "All signed-in SummitReady members will be able to see this post and its photo.", [
        { text: "Cancel", style: "cancel" },
        { text: "Share with members", onPress: apply },
      ]);
    }
  };
  const visiblePosts = view === "mine" ? minePosts : posts.filter(p => p.visibility === "members");
  return (
    <View style={styles.root} testID="community-hub">
      {!composing ? (
        <TouchableOpacity
          onPress={() => setComposing(true)}
          style={styles.composePrompt}
          accessibilityRole="button"
          accessibilityLabel="Write a new story or share a photo"
          testID="community-compose-open"
        >
          <View style={styles.dot} />
          <Text style={styles.composePromptText}>Share a moment from your journey…</Text>
          <ImagePlus size={19} color={BASECAMP.accent} />
        </TouchableOpacity>
      ) : (
      <View style={styles.composer}>
        <View style={styles.composerTop}><View style={styles.dot} /><Text style={styles.composerTitle}>Share a moment</Text><TouchableOpacity onPress={() => setComposing(false)} style={styles.composeClose} accessibilityRole="button" accessibilityLabel="Close post composer"><X size={18} color={BASECAMP.textMuted} /></TouchableOpacity></View>
        {kind === "badge" && draftBadge && <Text style={styles.privacy}>Ready to post your {draftBadge.title} badge. Choose an audience before posting.</Text>}
        <TextInput value={text} onChangeText={setText} placeholder="What happened out there?" placeholderTextColor={BASECAMP.textDim} multiline maxLength={600} style={styles.input} accessibilityLabel="Post text" testID="community-compose-text" />
        {photoUri && <View style={styles.previewWrap}><Image source={{ uri: photoUri }} style={styles.preview} accessibilityLabel="Selected photo preview" /><TouchableOpacity onPress={() => { setPhotoUri(null); setKind("story"); }} style={styles.removePhoto} accessibilityLabel="Remove selected photo" accessibilityRole="button"><X size={18} color={BASECAMP.text} /></TouchableOpacity></View>}
        <View style={styles.composeActions}>
          <TouchableOpacity onPress={pickPhoto} disabled={busy || submitting} style={styles.photoButton} accessibilityRole="button" accessibilityLabel="Choose a photo" testID="community-pick-photo"><ImagePlus size={18} color={BASECAMP.accent} /><Text style={styles.photoButtonText}>Photo</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setAudienceOpen(!audienceOpen)} style={styles.audienceButton} accessibilityRole="button" accessibilityLabel={`Audience: ${audienceLabel(audience)}`} testID="community-audience"><LockKeyhole size={14} color={BASECAMP.textMuted} /><Text style={styles.audienceText}>{audienceLabel(audience)}</Text><ChevronDown size={14} color={BASECAMP.textMuted} /></TouchableOpacity>
        </View>
        {audienceOpen && <View style={styles.options}>{(["private", "members"] as const).map(v => <TouchableOpacity key={v} style={styles.option} onPress={() => { setAudience(v); setAudienceOpen(false); }} accessibilityRole="button" accessibilityLabel={`Set audience to ${audienceLabel(v)}`}><Text style={styles.optionText}>{audienceLabel(v)}</Text></TouchableOpacity>)}</View>}
        <Text style={styles.privacy}>Photos on your device are never added automatically.</Text>
        <TouchableOpacity onPress={submit} disabled={busy || submitting || (!text.trim() && !photoUri)} style={[styles.submit, (busy || submitting || (!text.trim() && !photoUri)) && styles.disabled]} accessibilityRole="button" accessibilityLabel="Post to selected audience" testID="community-submit"><Send size={16} color={BASECAMP.accentInk} /><Text style={styles.submitText}>{submitting ? "Posting…" : "Post"}</Text></TouchableOpacity>
        {submitError && <Text style={styles.submitError} accessibilityRole="alert" testID="community-submit-error">{submitError}</Text>}
      </View>
      )}
      <View style={styles.switcher}>{(["members", "mine"] as const).map(v => <TouchableOpacity key={v} onPress={() => { setView(v); setVisiblePostCount(8); }} style={[styles.switch, view === v && styles.switchActive]} accessibilityRole="tab" accessibilityState={{ selected: view === v }}><Text style={[styles.switchText, view === v && styles.switchTextActive]}>{v === "members" ? "Members" : "My posts"}</Text></TouchableOpacity>)}</View>
      {loading ? <View style={styles.skeleton}><View style={styles.skeletonLine} /><View style={styles.skeletonLine} /></View>
        : error ? <View style={styles.empty}><Text style={styles.emptyTitle}>Stories unavailable</Text><Text style={styles.emptyBody}>{error}</Text><TouchableOpacity onPress={onRefresh} style={styles.retry} accessibilityRole="button"><RefreshCw size={16} color={BASECAMP.accent} /><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
        : visiblePosts.length === 0 ? <View style={styles.empty}><Camera size={24} color={BASECAMP.accent} /><Text style={styles.emptyTitle}>{view === "mine" ? "Your story starts here" : "No member stories yet"}</Text><Text style={styles.emptyBody}>{view === "mine" ? "Share a trail note or choose a photo above. Only you decide who sees it." : "When members choose to share, their stories will appear here."}</Text></View>
        : visiblePosts.slice(0, visiblePostCount).map(post => {
          const owned = minePosts.some(mine => mine.id === post.id);
          const source = post.hasPhoto ? photoSource(post) : null;
          const date = new Date(post.createdAt);
          return <View key={post.id} style={styles.post} testID={`community-post-${post.id}`}>
            <View style={styles.postHeader}>{post.authorAvatarUrl ? <Image source={{ uri: post.authorAvatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{post.authorName.charAt(0).toUpperCase()}</Text></View>}<View style={{ flex: 1 }}><Text style={styles.author} numberOfLines={1}>{post.authorName}</Text><Text style={styles.meta}>{Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {audienceLabel(post.visibility)}</Text></View></View>
            {source && <ExpoImage source={source} style={styles.postPhoto} contentFit="cover" cachePolicy="none" accessibilityLabel="Member shared photo" />}
            {post.badgeTitle && post.kind === "badge" && <Text style={styles.badge}>Award · {post.badgeTitle}</Text>}
            {!!post.text && <Text style={styles.postText}>{post.text}</Text>}
            <View style={styles.postActions}>{owned ? <><TouchableOpacity onPress={() => changeAudience(post)} disabled={busy} style={styles.action} accessibilityRole="button" accessibilityLabel={`Change audience to ${audienceLabel(post.visibility === "private" ? "members" : "private")}`}><LockKeyhole size={14} color={BASECAMP.accent} /><Text style={styles.actionText}>Change audience</Text></TouchableOpacity><TouchableOpacity onPress={() => confirmDelete(post.id)} disabled={busy} style={styles.iconAction} accessibilityRole="button" accessibilityLabel="Delete post"><Trash2 size={17} color={BASECAMP.textMuted} /></TouchableOpacity></> : <TouchableOpacity onPress={() => confirmReport(post.id)} disabled={busy} style={styles.action} accessibilityRole="button" accessibilityLabel="Report post"><Flag size={15} color={BASECAMP.textMuted} /><Text style={styles.actionText}>Report</Text></TouchableOpacity>}</View>
          </View>;
        })}
      {visiblePosts.length > visiblePostCount && (
        <TouchableOpacity
          onPress={() => setVisiblePostCount(count => count + 8)}
          style={styles.refresh}
          accessibilityRole="button"
          accessibilityLabel="Show more community posts"
        >
          <Text style={styles.refreshText}>Show more stories</Text>
        </TouchableOpacity>
      )}
      {view === "members" && !loading && visiblePosts.length === 0 && <DemoCommunityPreview />}
      <TouchableOpacity onPress={onRefresh} disabled={loading || busy} style={styles.refresh} accessibilityRole="button" accessibilityLabel="Refresh community posts"><RefreshCw size={15} color={BASECAMP.textMuted} /><Text style={styles.refreshText}>Refresh stories</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: SP.xl },
  composePrompt: { minHeight: 54, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelBorder },
  composePromptText: { ...TYPE.small, color: BASECAMP.textMuted, flex: 1 },
  composeClose: { marginLeft: "auto", width: HIT.minTarget, height: HIT.minTarget, alignItems: "center", justifyContent: "center" },
  composer: { padding: 16, borderRadius: 14, backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelBorder },
  composerTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BASECAMP.accent },
  composerTitle: { ...TYPE.bodyBold, color: BASECAMP.text },
  input: { ...TYPE.body, color: BASECAMP.text, minHeight: 82, paddingTop: 14, textAlignVertical: "top" },
  previewWrap: { position: "relative", marginBottom: 12 }, preview: { width: "100%", height: 190, borderRadius: 9 }, removePhoto: { position: "absolute", right: 8, top: 8, width: HIT.minTarget, height: HIT.minTarget, borderRadius: 22, backgroundColor: BASECAMP.ink, alignItems: "center", justifyContent: "center" },
  composeActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  photoButton: { minHeight: HIT.minTarget, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: BASECAMP.panelBorder },
  photoButtonText: { ...TYPE.smallBold, color: BASECAMP.accent },
  audienceButton: { minHeight: HIT.minTarget, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: BASECAMP.panelBorder },
  audienceText: { ...TYPE.caption, color: BASECAMP.textMuted },
  options: { backgroundColor: BASECAMP.ink, borderRadius: 8, borderWidth: 1, borderColor: BASECAMP.panelBorder, marginTop: 8 },
  option: { minHeight: HIT.minTarget, justifyContent: "center", paddingHorizontal: 12 }, optionText: { ...TYPE.small, color: BASECAMP.text },
  privacy: { ...TYPE.caption, color: BASECAMP.textDim, marginTop: 12 },
  submit: { minHeight: HIT.minTarget, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: BASECAMP.accent, marginTop: 14 },
  submitText: { ...TYPE.bodyBold, color: BASECAMP.accentInk }, disabled: { opacity: 0.4 },
  submitError: { ...TYPE.caption, color: BASECAMP.text, marginTop: SP.sm },
  switcher: { flexDirection: "row", marginTop: SP.sm, borderBottomWidth: 1, borderBottomColor: BASECAMP.panelBorder },
  switch: { flex: 1, minHeight: HIT.minTarget, alignItems: "center", justifyContent: "center" }, switchActive: { borderBottomWidth: 2, borderBottomColor: BASECAMP.accent }, switchText: { ...TYPE.smallBold, color: BASECAMP.textMuted }, switchTextActive: { color: BASECAMP.accent },
  skeleton: { padding: 18, gap: 12 }, skeletonLine: { height: 46, borderRadius: 8, backgroundColor: BASECAMP.panelSub },
  empty: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 18, gap: 8, borderBottomWidth: 1, borderBottomColor: BASECAMP.panelBorder },
  emptyTitle: { ...TYPE.heading, color: BASECAMP.text, textAlign: "center" }, emptyBody: { ...TYPE.small, color: BASECAMP.textMuted, textAlign: "center", lineHeight: 18 },
  retry: { minHeight: HIT.minTarget, flexDirection: "row", alignItems: "center", gap: 7 }, retryText: { ...TYPE.smallBold, color: BASECAMP.accent },
  post: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: BASECAMP.panelBorder },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 19 }, avatarFallback: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: BASECAMP.accentDim }, avatarLetter: { ...TYPE.bodyBold, color: BASECAMP.accent },
  author: { ...TYPE.bodyBold, color: BASECAMP.text }, meta: { ...TYPE.caption, color: BASECAMP.textDim, marginTop: 2 },
  postPhoto: { width: "100%", height: 220, borderRadius: 10, marginTop: 13 }, badge: { ...TYPE.smallBold, color: BASECAMP.accent, marginTop: 12 }, postText: { ...TYPE.body, color: BASECAMP.text, lineHeight: 21, marginTop: 12 },
  postActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 }, action: { minHeight: HIT.minTarget, flexDirection: "row", gap: 6, alignItems: "center" }, actionText: { ...TYPE.caption, color: BASECAMP.textMuted }, iconAction: { width: HIT.minTarget, height: HIT.minTarget, alignItems: "center", justifyContent: "center" },
  refresh: { minHeight: HIT.minTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }, refreshText: { ...TYPE.small, color: BASECAMP.textMuted },
});