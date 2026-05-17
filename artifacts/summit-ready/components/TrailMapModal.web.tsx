import React, { useEffect } from "react";
import { Linking } from "react-native";

interface Props {
  visible: boolean;
  url: string;
  onClose: () => void;
}

export function TrailMapModal({ visible, url, onClose }: Props) {
  useEffect(() => {
    if (visible && url) {
      Linking.openURL(url).catch(() => {});
      onClose();
    }
  }, [visible, url, onClose]);

  return null;
}
