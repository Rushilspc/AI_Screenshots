import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cache = new Map<string, { mtimeMs: number; text: string }>();

let tesseractJsWorker: { recognize: (img: string) => Promise<{ data?: { text?: string } }>; terminate: () => Promise<void> } | null = null;
let tesseractJsDisabled = false;

export async function extractTextFromImage(imagePath: string): Promise<string> {
  const stat = safeStat(imagePath);
  if (!stat) return "";

  const key = path.resolve(imagePath);
  const cached = cache.get(key);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.text;
  }

  const text = normalizeWhitespace(
    (await extractWithTesseractJs(imagePath)) ||
      (await extractWithTesseractCli(imagePath)) ||
      ""
  );

  cache.set(key, { mtimeMs: stat.mtimeMs, text });
  return text;
}

function safeStat(file: string): fs.Stats | null {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

async function extractWithTesseractJs(imagePath: string): Promise<string> {
  if (tesseractJsDisabled) return "";

  try {
    const runtimeRequire: NodeJS.Require = eval("require");
    const lib = runtimeRequire("tesseract.js") as {
      createWorker: (...args: unknown[]) => Promise<{ recognize: (img: string) => Promise<{ data?: { text?: string } }>; terminate: () => Promise<void> }>;
    };

    if (!tesseractJsWorker) {
      const options = resolveLangOptions(runtimeRequire);
      tesseractJsWorker = await lib.createWorker("eng", 1, options);
      process.once("exit", () => {
        void tesseractJsWorker?.terminate();
      });
    }

    const result = await tesseractJsWorker.recognize(imagePath);
    return result.data?.text ?? "";
  } catch {
    tesseractJsDisabled = true;
    return "";
  }
}

function resolveLangOptions(runtimeRequire: NodeJS.Require): Record<string, string> {
  try {
    const packageDir = path.dirname(runtimeRequire.resolve("@tesseract.js-data/eng"));
    return { langPath: packageDir };
  } catch {
    const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath || "";
    const resourcesTess = path.join(resourcesPath, "tessdata");
    if (resourcesTess && fs.existsSync(resourcesTess)) {
      return { langPath: resourcesTess };
    }
    return {};
  }
}

async function extractWithTesseractCli(imagePath: string): Promise<string> {
  const outputBase = path.join(os.tmpdir(), `ai-screenshots-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  try {
    await execFileAsync(
      process.platform === "win32" ? "tesseract.exe" : "tesseract",
      [imagePath, outputBase, "-l", "eng", "--dpi", "300"],
      { timeout: 12000 }
    );

    const outputTxt = `${outputBase}.txt`;
    if (!fs.existsSync(outputTxt)) {
      return "";
    }

    const text = fs.readFileSync(outputTxt, "utf8");
    return text;
  } catch {
    return "";
  } finally {
    safeUnlink(`${outputBase}.txt`);
    safeUnlink(`${outputBase}.osd`);
  }
}

function safeUnlink(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup failures
  }
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
