import React from "react";

import { PrimaryProfileScreen } from "../(tabs)/account";

/** Expedition shell keeps its own route and context, with the same primary Profile. */
export default function ExpeditionProfileScreen() {
  return <PrimaryProfileScreen screenName="expedition_profile" />;
}