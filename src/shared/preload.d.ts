import { CaptureMode, SearchResult } from "./types";

declare global {
  interface Window {
    aiScreenshots: {
      search: (query: string) => Promise<SearchResult>;
      capture: (mode: CaptureMode, priority: "high" | "normal" | "low") => Promise<void>;
      stats: () => Promise<{ totalScreenshots: number; queuedJobs: number; avgProcessingMs: number }>;
      onRefresh: (cb: () => void) => void;
    };
  }
}

export {};
