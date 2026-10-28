import { Heart, MessageCircle, RefreshCw, Send, Trash2 } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { randomUUID } from "expo-crypto";
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BASECAMP, HIT, SP, TYPE } from "@/constants/tokens";

import { PROFILE_FEED } from "@/constants/profileFeed";

export const FEED_CARD = PROFILE_FEED;

export type CommunityComment = {
  id: string;
  postId: string;
  text: string;
  ownerUserId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
};

type Props = {
  postId: string;
  viewerUserId: string | null | undefined;
  isPostOwner: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  onLike: (id: string, liked: boolean) => Promise<void>;
  onLoadComments: (id: string, cursor?: string) => Promise<{ comments: CommunityComment[]; nextCursor: string | null }>;
  onComment: (id: string, text: string, requestId: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
};

const errMessage = (e: unknown, fallback: string) => {
  const status = e && typeof e === "object" && "status" in e ? (e as { status?: number }).status : null;
  if (status === 401) return "Your session could not be verified. Sign in again and retry.";
  if (status === 403 || status === 404) return "This post's comments are no longer available.";
  return e instanceof Error && e.message ? e.message : fallback;
};
const isGone = (e: unknown) => {
  const status = e && typeof e === "object" && "status" in e ? (e as { status?: number }).status : null;
  return status === 403 || status === 404;
};

const ago = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** Like + comments for a single post. Mount with a key including the viewer ID so state never crosses accounts. */
export function CommunityEngagement({ postId, viewerUserId, isPostOwner, likeCount, commentCount, likedByMe, onLike, onLoadComments, onComment, onDeleteComment }: Props) {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Like: confirmed (not optimistic) override that stays until server props catch up.
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ liked: boolean; base: boolean; baseCount: number } | null>(null);
  const live = confirmed && confirmed.base === likedByMe && confirmed.baseCount === likeCount ? confirmed : null;
  const liked = live ? live.liked : likedByMe;
  const likes = live ? Math.max(0, likeCount + (live.liked === likedByMe ? 0 : live.liked ? 1 : -1)) : likeCount;

  const toggleLike = async () => {
    if (likePending || !viewerUserId) return;
    const target = !liked;
    setLikePending(true); setLikeError(null);
    try {
      await onLike(postId, target);
      if (alive.current) setConfirmed({ liked: target, base: likedByMe, baseCount: likeCount });
    } catch (e) {
      if (alive.current) setLikeError(errMessage(e, "Could not update like. Try again."));
    } finally {
      if (alive.current) setLikePending(false);
    }
  };

  // Comments
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [draft, setDraft] = useState("");
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const loadFirst = async () => {
    const seq = ++loadSeq.current;
    setLoading(true); setLoadError(null);
    try {
      const page = await onLoadComments(postId);
      if (!alive.current || seq !== loadSeq.current) return;
      setComments(page.comments); setCursor(page.nextCursor);
    } catch (e) {
      if (!alive.current || seq !== loadSeq.current) return;
      if (isGone(e)) { setGone(true); setComments([]); setCursor(null); }
      setLoadError(errMessage(e, "Could not load comments."));
    } finally {
      if (alive.current && seq === loadSeq.current) setLoading(false);
    }
  };
  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    const seq = loadSeq.current;
    setLoadingMore(true); setLoadError(null);
    try {
      const page = await onLoadComments(postId, cursor);
      if (!alive.current || seq !== loadSeq.current) return;
      setComments(prev => [...prev, ...page.comments.filter(c => !prev.some(p => p.id === c.id))]);
      setCursor(page.nextCursor);
    } catch (e) {
      if (!alive.current || seq !== loadSeq.current) return;
      if (isGone(e)) { setGone(true); setComments([]); setCursor(null); }
      setLoadError(errMessage(e, "Could not load more comments."));
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !gone) void loadFirst();
  };

  const trimmed = draft.trim();
  const canPost = !!viewerUserId && trimmed.length >= 1 && trimmed.length <= 600 && !posting && !gone;
  const changeDraft = (t: string) => { setDraft(t); setRequestId(randomUUID()); setPostError(null); };
  const submit = async () => {
    if (!canPost) return;
    setPosting(true); setPostError(null);
    try {
      await onComment(postId, trimmed, requestId);
      if (!alive.current) return;
      setDraft(""); setRequestId(randomUUID());
      void loadFirst();
    } catch (e) {
      if (!alive.current) return;
      if (isGone(e)) { setGone(true); setComments([]); setCursor(null); }
      setPostError(errMessage(e, "Could not post comment. Your reply is still here."));
    } finally {
      if (alive.current) setPosting(false);
    }
  };

  const doDelete = async (commentId: string) => {
    setDeleting(commentId); setLoadError(null);
    try {
      await onDeleteComment(postId, commentId);
      if (alive.current) void loadFirst();
    } catch (e) {
      if (alive.current) setLoadError(errMessage(e, "Could not delete comment."));
    } finally {
      if (alive.current) setDeleting(null);
    }
  };
  const confirmDelete = (c: CommunityComment) => {
    const label = c.ownerUserId === viewerUserId ? "Delete your comment?" : "Remove this comment from your post?";
    if (Platform.OS === "web") { if (window.confirm(label)) void doDelete(c.id); return; }
    Alert.alert(label, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void doDelete(c.id) },
    ]);
  };

  return (
    <View>
      <View style={styles.bar}>
        <TouchableOpacity onPress={toggleLike} disabled={likePending || !viewerUserId} style={[styles.control, likePending && styles.pending]}
          accessibilityRole="button" accessibilityState={{ selected: liked, busy: likePending }}
          accessibilityLabel={`${liked ? "Unlike" : "Like"} post, ${likes} ${likes === 1 ? "like" : "likes"}`} testID={`community-like-${postId}`}>
          <Heart size={19} color={liked ? FEED_CARD.like : FEED_CARD.muted} fill={liked ? FEED_CARD.like : "transparent"} />
          <Text style={[styles.count, liked && { color: FEED_CARD.like }]}>{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleOpen} style={styles.control} accessibilityRole="button" accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? "Hide" : "Show"} comments, ${commentCount}`} testID={`community-comments-${postId}`}>
          <MessageCircle size={19} color={open ? FEED_CARD.accent : FEED_CARD.muted} />
          <Text style={[styles.count, open && { color: FEED_CARD.accent }]}>{commentCount}</Text>
        </TouchableOpacity>
      </View>
      {likeError && <Text style={styles.error} accessibilityRole="alert">{likeError}</Text>}

      {open && (
        <View style={styles.thread}>
          {gone ? <Text style={styles.note}>Comments are unavailable for this post.</Text> : <>
            {loading && comments.length === 0 ? (
              <View style={styles.skel}><View style={styles.skelLine} /><View style={[styles.skelLine, { width: "62%" }]} /></View>
            ) : comments.length === 0 && !loadError ? (
              <Text style={styles.note}>No comments yet. Start the conversation.</Text>
            ) : comments.map(c => {
              const canDelete = c.ownerUserId === viewerUserId || isPostOwner;
              return (
                <View key={c.id} style={styles.comment}>
                  {c.authorAvatarUrl ? <Image source={{ uri: c.authorAvatarUrl }} style={styles.cAvatar} /> :
                    <View style={[styles.cAvatar, styles.cAvatarFallback]}><Text style={styles.cInitial}>{c.authorName.charAt(0).toUpperCase()}</Text></View>}
                  <View style={styles.bubble}>
                    <Text style={styles.cAuthor} numberOfLines={1}>{c.authorName} <Text style={styles.cTime}>· {ago(c.createdAt)}</Text></Text>
                    <Text style={styles.cText}>{c.text}</Text>
                  </View>
                  {canDelete && (
                    <TouchableOpacity onPress={() => confirmDelete(c)} disabled={deleting === c.id} style={styles.iconBtn}
                      accessibilityRole="button" accessibilityLabel={c.ownerUserId === viewerUserId ? "Delete your comment" : "Remove comment from your post"}>
                      {deleting === c.id ? <ActivityIndicator size="small" color={FEED_CARD.dim} /> : <Trash2 size={15} color={FEED_CARD.dim} />}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {loadError && (
              <View style={styles.errorRow}>
                <Text style={[styles.error, { flex: 1, marginTop: 0 }]} accessibilityRole="alert">{loadError}</Text>
                <TouchableOpacity onPress={() => void loadFirst()} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading comments">
                  <RefreshCw size={14} color={FEED_CARD.accent} /><Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            {cursor && (
              <TouchableOpacity onPress={() => void loadMore()} disabled={loadingMore} style={styles.more} accessibilityRole="button" accessibilityLabel="Load more comments">
                <Text style={styles.moreText}>{loadingMore ? "Loading…" : "Load more comments"}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.composer}>
              <TextInput value={draft} onChangeText={changeDraft} placeholder="Add a comment" placeholderTextColor={FEED_CARD.dim}
                multiline maxLength={600} style={styles.input} editable={!posting} accessibilityLabel="Comment text" testID={`community-comment-input-${postId}`} />
              <TouchableOpacity onPress={() => void submit()} disabled={!canPost} style={[styles.send, !canPost && styles.sendOff]}
                accessibilityRole="button" accessibilityLabel="Post comment" testID={`community-comment-send-${postId}`}>
                {posting ? <ActivityIndicator size="small" color={BASECAMP.accentInk} /> : <Send size={16} color={canPost ? BASECAMP.accentInk : FEED_CARD.dim} />}
              </TouchableOpacity>
            </View>
            {trimmed.length > 540 && <Text style={styles.limit}>{600 - trimmed.length} characters left</Text>}
            {postError && <Text style={styles.error} accessibilityRole="alert">{postError}</Text>}
          </>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: SP.xs, marginTop: SP.sm, marginLeft: -10 },
  control: { minHeight: HIT.minTarget, minWidth: HIT.minTarget, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  pending: { opacity: 0.5 },
  count: { ...TYPE.smallBold, color: FEED_CARD.muted },
  error: { ...TYPE.caption, color: FEED_CARD.danger, marginTop: SP.xs },
  errorRow: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginTop: SP.xs },
  retry: { minHeight: HIT.minTarget, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 6 },
  retryText: { ...TYPE.smallBold, color: FEED_CARD.accent },
  thread: { borderTopWidth: 1, borderTopColor: FEED_CARD.divider, paddingTop: SP.md, marginTop: 2, gap: SP.sm },
  note: { ...TYPE.small, color: FEED_CARD.dim },
  skel: { gap: 8 }, skelLine: { height: 34, borderRadius: 10, backgroundColor: FEED_CARD.sunken },
  comment: { flexDirection: "row", alignItems: "flex-start", gap: SP.sm },
  cAvatar: { width: 28, height: 28, borderRadius: 14, marginTop: 2 },
  cAvatarFallback: { backgroundColor: FEED_CARD.accentSoft, alignItems: "center", justifyContent: "center" },
  cInitial: { ...TYPE.smallBold, color: FEED_CARD.accent },
  bubble: { flex: 1, backgroundColor: FEED_CARD.sunken, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  cAuthor: { ...TYPE.smallBold, color: FEED_CARD.text },
  cTime: { ...TYPE.caption, color: FEED_CARD.dim },
  cText: { ...TYPE.body, color: FEED_CARD.text, marginTop: 2 },
  iconBtn: { width: HIT.minTarget, height: HIT.minTarget, alignItems: "center", justifyContent: "center", marginRight: -10 },
  more: { minHeight: HIT.minTarget, justifyContent: "center" },
  moreText: { ...TYPE.smallBold, color: FEED_CARD.accent },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: SP.sm, marginTop: 2 },
  input: { ...TYPE.body, flex: 1, color: FEED_CARD.text, minHeight: HIT.minTarget, maxHeight: 120, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderRadius: 22, backgroundColor: FEED_CARD.sunken, borderWidth: 1, borderColor: FEED_CARD.border, textAlignVertical: "top" },
  send: { width: HIT.minTarget, height: HIT.minTarget, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: BASECAMP.accent },
  sendOff: { backgroundColor: FEED_CARD.sunken },
  limit: { ...TYPE.caption, color: FEED_CARD.dim, textAlign: "right" },
});
