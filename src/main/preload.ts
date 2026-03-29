import { contextBridge, ipcRenderer } from "electron";
import { CaptureMode, SearchResult } from "../shared/types";

contextBridge.exposeInMainWorld("aiScreenshots", {
  search: (query: string): Promise<SearchResult> => ipcRenderer.invoke("search:query", query),
  capture: (mode: CaptureMode, priority: "high" | "normal" | "low"): Promise<void> =>
    ipcRenderer.invoke("capture:trigger", mode, priority),
  importFolder: (): Promise<number> => ipcRenderer.invoke("import:folder"),
  stats: (): Promise<{ totalScreenshots: number; queuedJobs: number; avgProcessingMs: number }> =>
    ipcRenderer.invoke("stats:get"),
  onRefresh: (cb: () => void) => {
    ipcRenderer.on("app:refreshed", cb);
  }
});

declare global {
  interface Window {
    aiScreenshots: {
      search: (query: string) => Promise<SearchResult>;
      capture: (mode: CaptureMode, priority: "high" | "normal" | "low") => Promise<void>;
      importFolder: () => Promise<number>;
      stats: () => Promise<{ totalScreenshots: number; queuedJobs: number; avgProcessingMs: number }>;
      onRefresh: (cb: () => void) => void;
    };
  }
}
