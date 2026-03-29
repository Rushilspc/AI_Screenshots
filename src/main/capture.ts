import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CaptureJob {
  mode: "region" | "fullscreen" | "window";
  priority: "high" | "normal" | "low";
  source: "hotkey" | "import" | "manual";
  filePath?: string;
}

const IMAGE_EXT_REGEX = /\.(png|jpg|jpeg|bmp|webp|tiff?)$/i;

export class CaptureService {
  private screenshotRoot: string;

  constructor() {
    this.screenshotRoot = path.join(app.getPath("pictures"), "AI Screenshots");
    fs.mkdirSync(this.screenshotRoot, { recursive: true });
  }

  async capture(job: CaptureJob): Promise<string> {
    if (job.filePath && fs.existsSync(job.filePath)) {
      return job.filePath;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(this.screenshotRoot, `${timestamp}-${job.mode}.png`);

    if (process.platform !== "win32") {
      fs.writeFileSync(outputPath, "");
      return outputPath;
    }

    const psScript = buildPowerShellCaptureScript(outputPath, job.mode);
    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", psScript]);

    return outputPath;
  }

  getAutoImportCandidates(): string[] {
    const candidates = [
      path.join(app.getPath("pictures"), "Screenshots"),
      path.join(app.getPath("pictures"), "AI Screenshots")
    ];

    const files: string[] = [];
    for (const folder of candidates) {
      files.push(...this.getImportCandidatesFromFolder(folder));
    }
    return unique(files);
  }

  getImportCandidatesFromFolder(folder: string): string[] {
    if (!fs.existsSync(folder)) return [];

    const results: string[] = [];
    const stack = [folder];

    while (stack.length > 0) {
      const current = stack.pop()!;
      let entries: fs.Dirent[] = [];

      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (entry.isFile() && IMAGE_EXT_REGEX.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }
}

function buildPowerShellCaptureScript(outputPath: string, mode: CaptureJob["mode"]): string {
  if (mode === "fullscreen") {
    return `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size); $bmp.Save('${outputPath.replace(/\\/g, "\\\\")}'); $g.Dispose(); $bmp.Dispose();`;
  }

  // Region/window modes are delegated to Snipping Tool workflow in MVP.
  return `Start-Process ms-screenclip:; Start-Sleep -Seconds 2; Add-Type -AssemblyName System.Windows.Forms; if ([System.Windows.Forms.Clipboard]::ContainsImage()) { $img=[System.Windows.Forms.Clipboard]::GetImage(); $img.Save('${outputPath.replace(/\\/g, "\\\\")}'); }`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
