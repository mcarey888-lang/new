import { clerkClient } from "@clerk/express";
import { publicDisplayName } from "../lib/publicDisplayName";

export async function getAuthor(userId: string): Promise<{ name: string; avatarUrl: string | null }> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return { name: publicDisplayName(user), avatarUrl: user.imageUrl || null };
  } catch {
    return { name: "SummitReady member", avatarUrl: null };
  }
}
