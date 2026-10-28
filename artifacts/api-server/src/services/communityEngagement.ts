import { and, count, eq, inArray, sql } from "drizzle-orm";
import { communityComments, communityLikes, db } from "@workspace/db";

export async function communityEngagement(postIds: string[], viewerId: string) {
  if (!postIds.length) return new Map<string, { likeCount: number; commentCount: number; likedByMe: boolean }>();
  const [likes, comments] = await Promise.all([
    db.select({ postId: communityLikes.postId, total: count(),
      liked: sql<boolean>`bool_or(${communityLikes.userId} = ${viewerId})`,
    }).from(communityLikes).where(inArray(communityLikes.postId, postIds)).groupBy(communityLikes.postId),
    db.select({ postId: communityComments.postId, total: count() })
      .from(communityComments).where(inArray(communityComments.postId, postIds)).groupBy(communityComments.postId),
  ]);
  const result = new Map(postIds.map(id => [id, { likeCount: 0, commentCount: 0, likedByMe: false }]));
  for (const like of likes) result.set(like.postId, { ...result.get(like.postId)!, likeCount: Number(like.total), likedByMe: like.liked });
  for (const comment of comments) result.get(comment.postId)!.commentCount = Number(comment.total);
  return result;
}
