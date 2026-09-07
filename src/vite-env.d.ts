/// <reference types="vite/client" />

import type { QuarkBridge } from "./types";

declare global {
  interface Window {
    quark: QuarkBridge;
  }
}

export {};
