import React, { useEffect, useRef, useState } from "react";
import { Image, ImageBackground, type ImageProps, type ImageBackgroundProps } from "react-native";
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import { useAuth } from "@clerk/expo";
import { refreshedMountainArtworkUri, watchMountainArtwork } from "@/utils/mountainArtworkSlots";

function useSlotSource<T>(source: T): T {
  const { userId, getToken } = useAuth();
  const token = useRef(getToken);
  token.current = getToken;
  const uri = source && typeof source === "object" && "uri" in source
    ? String(source.uri ?? "") : "";
  const [ready, setReady] = useState<{ uri: string; userId: string; revision: string; mountainId: string } | null>(null);
  useEffect(() => {
    if (!uri || !userId) return;
    return watchMountainArtwork(uri, userId, () => token.current(),
      (revision, mountainId) => setReady({ uri, userId, revision, mountainId }));
  }, [uri, userId]);
  return ready?.uri === uri && ready.userId === userId
    ? { ...source, uri: refreshedMountainArtworkUri(uri, ready.revision, ready.mountainId) }
    : source;
}

export function MountainArtworkImage(props: ImageProps) {
  return <Image {...props} source={useSlotSource(props.source)} />;
}

export function MountainArtworkBackground(props: ImageBackgroundProps) {
  return <ImageBackground {...props} source={useSlotSource(props.source)} />;
}

export function ExpoMountainArtworkImage(props: ExpoImageProps) {
  return <ExpoImage {...props} source={useSlotSource(props.source)} />;
}
