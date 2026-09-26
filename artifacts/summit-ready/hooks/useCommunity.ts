import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, type ImageSourcePropType } from "react-native";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import {
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPostPhoto,
  getGetCommunityPostPhotoUrl,
  getGetCommunityPostsQueryKey,
  reportCommunityPost,
  updateCommunityPostVisibility,
  useGetCommunityPosts,
} from "@workspace/api-client-react";
import { authenticatedHeaders, responseError } from "@/utils/authRequest";
import type { CommunityCreate, CommunityHubProps, CommunityPost } from "@/components/profile/CommunityHub";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "summitready.uk"}`;

export function useCommunity(visible = true): CommunityHubProps {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  // The profile and settings must not fetch feeds or decode photos just to
  // display the You header. Activate the community only on its visible tabs.
  const enabled = visible && isLoaded && Boolean(isSignedIn && userId);
  const [busy, setBusy] = useState(false);
  const [imageToken, setImageToken] = useState<{ userId: string; token: string } | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const previousUserId = useRef<string | null>(null);
  const mineKey = [...getGetCommunityPostsQueryKey({ scope: "mine" }), userId] as const;
  const membersKey = [...getGetCommunityPostsQueryKey({ scope: "members" }), userId] as const;
  const mine = useGetCommunityPosts({ scope: "mine" }, { query: {
    queryKey: mineKey, enabled, staleTime: 30_000,
  } });
  const members = useGetCommunityPosts({ scope: "members" }, { query: {
    queryKey: membersKey, enabled, staleTime: 30_000,
  } });

  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) {
      const formerUser = previousUserId.current;
      queryClient.removeQueries({ queryKey: [...getGetCommunityPostsQueryKey({ scope: "mine" }), formerUser], exact: true });
      queryClient.removeQueries({ queryKey: [...getGetCommunityPostsQueryKey({ scope: "members" }), formerUser], exact: true });
    }
    previousUserId.current = userId ?? null;
  }, [queryClient, userId]);

  const minePosts = useMemo(() => enabled ? (mine.data?.posts ?? []) as CommunityPost[] : [], [enabled, mine.data]);
  const posts = useMemo(() => enabled ? (members.data?.posts ?? []) as CommunityPost[] : [], [enabled, members.data]);
  const hasPhotos = useMemo(
    () => [...posts, ...minePosts].some(post => post.hasPhoto),
    [posts, minePosts],
  );
  useEffect(() => {
    if (!enabled || !userId || Platform.OS === "web" || !hasPhotos) {
      setImageToken(current => current === null ? current : null);
      return;
    }
    let active = true;
    // Clerk can supply a new getToken function on re-render. Depending on that
    // function here would request a token, update state, then repeat forever.
    setImageToken(current => current?.userId === userId ? current : null);
    void getTokenRef.current().then(token => { if (active) setImageToken(token ? { userId, token } : null); })
      .catch(() => { if (active) setImageToken(null); });
    return () => { active = false; };
  }, [enabled, hasPhotos, userId]);

  const [webPhotos, setWebPhotos] = useState<{ userId: string; urls: Record<string, string> }>({ userId: "", urls: {} });

  // Web image elements cannot pass Authorization headers. Blob URLs stay
  // inside this signed-in session and are revoked when the visible set changes.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!enabled || !userId) {
      setWebPhotos(current => current.userId ? { userId: "", urls: {} } : current);
      return;
    }
    let active = true;
    const ids = [...new Set([...posts, ...minePosts].filter(post => post.hasPhoto).map(post => post.id))];
    const urls: string[] = [];
    const load = async () => {
      const entries: (readonly [string, string])[] = [];
      // A full member feed can have many photos; don't start all protected
      // downloads on the same frame or block navigation with a request burst.
      for (let offset = 0; offset < ids.length && active; offset += 4) {
        const batch = await Promise.all(ids.slice(offset, offset + 4).map(async id => {
          try {
            const blob = await getCommunityPostPhoto(id);
            const url = URL.createObjectURL(blob);
            urls.push(url);
            return [id, url] as const;
          } catch {
            return null;
          }
        }));
        entries.push(...batch.filter((entry): entry is readonly [string, string] => entry !== null));
      }
      return entries;
    };
    void load().then(entries => {
      if (active) setWebPhotos({ userId, urls: Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)) });
      else urls.forEach(url => URL.revokeObjectURL(url));
    });
    return () => {
      active = false;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [enabled, minePosts, posts, userId]);

  const refresh = useCallback(async () => {
    await Promise.all([mine.refetch(), members.refetch()]);
  }, [mine.refetch, members.refetch]);

  const revalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: mineKey }),
      queryClient.invalidateQueries({ queryKey: membersKey }),
    ]);
  }, [queryClient, userId]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (!enabled || busy) throw new Error("Sign in to share with members.");
    setBusy(true);
    try {
      await action();
      await revalidate();
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, revalidate]);

  const onCreate = useCallback((input: CommunityCreate) => run(async () => {
    const token = await getToken();
    if (!token) throw new Error("Your sign-in session has expired. Sign in again to post; your draft is still here.");
    const isPhoto = input.kind === "photo";
    // Photos remain private until their bytes are safely stored. Visibility is
    // changed only AFTER the upload succeeds, and only when explicitly chosen.
    const created = await createCommunityPost({
      kind: input.kind,
      text: input.text,
      ...(input.badgeId ? { badgeId: input.badgeId } : {}),
      ...(input.badgeTitle ? { badgeTitle: input.badgeTitle } : {}),
      visibility: isPhoto ? "private" : input.visibility,
    }, { headers: authenticatedHeaders(token) });
    if (!isPhoto) return;
    try {
      if (!input.photoUri) throw new Error("Select a photo before posting.");
      const response = await fetch(input.photoUri);
      if (!response.ok) throw new Error("Could not read the selected photo.");
      const photo = await response.blob();
      if (photo.size > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB.");
      const mime = photo.type.split(";")[0] || (/\.(png)$/i.test(input.photoUri) ? "image/png" : /\.(webp)$/i.test(input.photoUri) ? "image/webp" : "image/jpeg");
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new Error("Choose a JPEG, PNG, or WebP photo.");
      const upload = await fetch(`${BASE_URL}${getGetCommunityPostPhotoUrl(created.post.id)}`, {
        method: "PUT",
        headers: { ...authenticatedHeaders(token), "Content-Type": mime },
        body: photo,
      });
      if (!upload.ok) throw await responseError(upload, "Photo could not be uploaded");
      if (input.visibility === "members") {
        await updateCommunityPostVisibility(created.post.id, { visibility: "members" });
      }
    } catch (error) {
      // Avoid retaining a private empty photo post if a device upload fails.
      await deleteCommunityPost(created.post.id).catch(() => {});
      throw error;
    }
  }), [getToken, run]);

  const onVisibility = useCallback((id: string, visibility: "private" | "members") =>
    run(async () => { await updateCommunityPostVisibility(id, { visibility }); }), [run]);
  const onDelete = useCallback((id: string) =>
    run(async () => { await deleteCommunityPost(id); }), [run]);
  const onReport = useCallback((id: string) =>
    run(async () => { await reportCommunityPost(id); }), [run]);

  const photoSource = useCallback((post: CommunityPost): ImageSourcePropType | null => {
    if (!post.hasPhoto) return null;
    if (Platform.OS === "web") {
      const url = webPhotos.userId === userId ? webPhotos.urls[post.id] : null;
      return url ? { uri: url } : null;
    }
    if (!imageToken || imageToken.userId !== userId) return null;
    return { uri: `${BASE_URL}${getGetCommunityPostPhotoUrl(post.id)}`, headers: authenticatedHeaders(imageToken.token) };
  }, [imageToken, webPhotos, userId]);

  return {
    posts,
    minePosts,
    loading: enabled && (mine.isLoading || members.isLoading),
    error: mine.isError || members.isError ? "Could not load member stories. Try signing in again." : null,
    busy,
    onRefresh: () => { void refresh(); },
    onCreate,
    onVisibility,
    onDelete,
    onReport,
    photoSource,
  };
}