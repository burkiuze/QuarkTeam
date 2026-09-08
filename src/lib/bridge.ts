import type { QuarkBridge } from "../types";

const MISSING_BRIDGE =
  "QuarkCode desktop bridge unavailable. Start the app with `npm run dev`, which opens the Electron window — the Vite URL alone has no workspace access.";

export function hasBridge() {
  return typeof window !== "undefined" && Boolean(window.quark);
}

/**
 * Every workspace, terminal and model call goes through the Electron preload
 * bridge. Accessing it via this helper turns a missing bridge into a readable
 * message instead of "Cannot read properties of undefined".
 */
export function bridge(): QuarkBridge {
  if (!window.quark) throw new Error(MISSING_BRIDGE);
  return window.quark;
}
