export type CommunityAudiencePost = {
  ownerUserId: string;
  visibility: string;
};

export type CommunityPostContentInput = {
  kind: unknown;
  text: unknown;
  badgeId: unknown;
  badgeTitle: unknown;
};

export function canReadCommunityPost(post: CommunityAudiencePost, viewerUserId: string): boolean {
  return post.ownerUserId === viewerUserId || post.visibility === "members";
}

export function isValidCommunityPostContent(input: CommunityPostContentInput): boolean {
  const { kind, text, badgeId, badgeTitle } = input;
  if (typeof text !== "string" || text.length > 600
    || (badgeId !== null && (typeof badgeId !== "string" || badgeId.length > 128))
    || (badgeTitle !== null && (typeof badgeTitle !== "string" || badgeTitle.length > 160))) {
    return false;
  }
  if (kind === "story" || kind === "badge") return text.trim().length > 0;
  return true;
}

export function canReportCommunityPost(post: CommunityAudiencePost, reporterUserId: string): boolean {
  return post.ownerUserId !== reporterUserId && post.visibility === "members";
}

export function isHiddenByReport(
  post: { id: string; ownerUserId: string },
  viewerUserId: string,
  reportedPostIds: ReadonlySet<string>,
): boolean {
  return post.ownerUserId !== viewerUserId && reportedPostIds.has(post.id);
}

export async function resolveUniqueCommunityAuthors<T>(
  userIds: readonly string[],
  lookup: (userId: string) => Promise<T>,
): Promise<Map<string, T>> {
  const uniqueIds = [...new Set(userIds)];
  const authors = await Promise.all(uniqueIds.map(async (userId) => [userId, await lookup(userId)] as const));
  return new Map(authors);
}

export function matchesCommunityImageFormat(mimeType: string, format?: string): boolean {
  return (mimeType === "image/jpeg" && format === "jpeg")
    || (mimeType === "image/png" && format === "png")
    || (mimeType === "image/webp" && format === "webp");
}