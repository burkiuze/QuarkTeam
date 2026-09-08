import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
// Inline workers keep the editor working when the packaged app is served from
// file://, where a separate worker file cannot be loaded.
import editorWorker from "monaco-editor/editor/editor.worker.js?worker&inline";
import cssWorker from "monaco-editor/language/css/css.worker.js?worker&inline";
import htmlWorker from "monaco-editor/language/html/html.worker.js?worker&inline";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker&inline";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker&inline";

/**
 * @monaco-editor/react loads the editor from a CDN by default, which leaves a
 * desktop IDE unusable offline and pulls remote code into a renderer that has a
 * privileged preload bridge. Bind the bundled copy instead.
 */
declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

window.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

loader.config({ monaco });

export {};
