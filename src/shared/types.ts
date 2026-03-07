export type CaptureMode = "region" | "fullscreen" | "window";

export interface ScreenshotRecord {
  id: number;
  filePath: string;
  previewPath: string;
  capturedAt: string;
  source: string;
  extractedText: string;
  tags: string[];
  embedding: number[];
  score?: number;
}

export interface SearchResult {
  query: string;
  results: ScreenshotRecord[];
}

export interface AppStats {
  totalScreenshots: number;
  queuedJobs: number;
  avgProcessingMs: number;
}
