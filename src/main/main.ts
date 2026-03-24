import path from "node:path";
import fs from "node:fs";
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, nativeImage } from "electron";
import Store from "electron-store";
import { analyzeScreenshot } from "./ai";
import { CaptureJob, CaptureService } from "./capture";
import { ScreenshotDatabase } from "./db";
import { PriorityQueue } from "./queue";
import { AppStats } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

type SettingsStore = {
  get: (key: "avgProcessingMs") => number;
  set: (key: "avgProcessingMs", value: number) => void;
};

const settings = new Store<{ avgProcessingMs: number }>({ defaults: { avgProcessingMs: 0 } }) as unknown as SettingsStore;
const db = new ScreenshotDatabase();
const captureService = new CaptureService();

const queue = new PriorityQueue(async (job) => {
  const start = Date.now();
  const imagePath = await captureService.capture(job);
  if (!fs.existsSync(imagePath)) {
    return;
  }

  const analysis = await analyzeScreenshot(imagePath);
  db.upsert({
    filePath: imagePath,
    previewPath: imagePath,
    capturedAt: new Date().toISOString(),
    source: job.source,
    extractedText: analysis.extractedText,
    tags: analysis.tags,
    embedding: analysis.embedding
  });

  const duration = Date.now() - start;
  const previous = settings.get("avgProcessingMs");
  settings.set("avgProcessingMs", previous === 0 ? duration : Math.round((previous + duration) / 2));
  mainWindow?.webContents.send("app:refreshed");
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 1024,
    minHeight: 700,
    title: "AI Screenshots",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAQ0lEQVR42mP8//8/AzWAiSTVxMTE/0eQYQhGECxA0xUQhEhjGgYg0xQSBhMNA5Ew0DgTDQORMNA4Ew0DkTjAAB4iQ8TVM4qGAAAAABJRU5ErkJggg=="
  );
  tray = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    { label: "Open AI Screenshots", click: () => mainWindow?.show() },
    { label: "Capture Fullscreen", click: () => enqueueCapture("fullscreen") },
    { label: "Quit", click: () => { app.isQuiting = true; app.quit(); } }
  ]);

  tray.setToolTip("AI Screenshots");
  tray.setContextMenu(menu);
  tray.on("double-click", () => mainWindow?.show());
}

function enqueueCapture(mode: CaptureJob["mode"]): void {
  queue.enqueue({
    mode,
    priority: "high",
    source: "hotkey"
  });
}

function registerHotkeys(): void {
  globalShortcut.register("Super+Shift+S", () => {
    enqueueCapture("region");
  });
}

function scheduleAutoImport(): void {
  const imports = captureService.getAutoImportCandidates();
  for (const filePath of imports) {
    queue.enqueue({
      mode: "fullscreen",
      priority: "low",
      source: "import",
      filePath
    });
  }
}

function wireIpc(): void {
  ipcMain.handle("search:query", async (_event, query: string) => {
    const normalized = query.trim();
    if (!normalized) {
      return { query, results: [] };
    }
    const embedding = (await analyzeScreenshot(normalized)).embedding;
    return { query: normalized, results: db.search(normalized, embedding, 5) };
  });

  ipcMain.handle("capture:trigger", async (_event, mode: CaptureJob["mode"], priority: CaptureJob["priority"]) => {
    queue.enqueue({ mode, priority, source: "manual" });
  });

  ipcMain.handle("stats:get", (): AppStats => ({
    totalScreenshots: db.count(),
    queuedJobs: queue.size(),
    avgProcessingMs: settings.get("avgProcessingMs")
  }));
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerHotkeys();
  wireIpc();
  scheduleAutoImport();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // keep app running in tray on Windows for MVP behavior
  }
});

app.on("before-quit", () => {
  app.isQuiting = true;
  globalShortcut.unregisterAll();
});

declare global {
  namespace Electron {
    interface App {
      isQuiting?: boolean;
    }
  }
}
