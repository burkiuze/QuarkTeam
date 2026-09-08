/// <reference types="vite/client" />

import type { QuarkBridge } from "./types";

declare global {
  interface Window {
    // Injected by the Electron preload bridge, so it is absent when the Vite
    // dev server page is opened in a normal browser.
    quark?: QuarkBridge;
  }
}

export {};
