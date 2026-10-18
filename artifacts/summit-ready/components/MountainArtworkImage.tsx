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

export function MountainArtworkImage({
  fallback, showFallbackUntilReady = false, ...props
}: ImageProps & { fallback?: React.ReactNode; showFallbackUntilReady?: boolean }) {
  const source = useSlotSource(props.source);
  const uri = source && typeof source === "object" && "uri" in source ? source.uri : "";
  const [failedUri, setFailedUri] = useState<unknown>(null);
  const visible = (!showFallbackUntilReady || source !== props.source) && failedUri !== uri;
  if (!fallback) return <Image {...props} source={source} />;
  // Keep the authenticated slot watcher mounted behind the illustration.
  // Replacing the entire Image with a placeholder would prevent generation.
  return <>{fallback}<Image {...props} source={source}
    style={[props.style, { opacity: visible ? 1 : 0 }]}
    onError={event => { setFailedUri(uri); props.onError?.(event); }} /></>;
}

export function MountainArtworkBackground(props: ImageBackgroundProps) {
  return <ImageBackground {...props} source={useSlotSource(props.source)} />;
}

export function ExpoMountainArtworkImage(props: ExpoImageProps) {
  return <ExpoImage {...props} source={useSlotSource(props.source)} />;
}
