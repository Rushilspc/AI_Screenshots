import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeScreenshot } from "../src/main/ai";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function testQueryMode(): Promise<void> {
  const result = await analyzeScreenshot("car parked near a cat in browser window");
  assert(result.tags.includes("vehicle"), "query analysis should infer vehicle tag");
  assert(result.tags.includes("animal"), "query analysis should infer animal tag");
}

async function testFileModeWithSidecar(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-shot-test-"));
  const imagePath = path.join(tempDir, "sample-image.png");
  const sidecarPath = `${imagePath}.txt`;

  fs.writeFileSync(imagePath, "");
  fs.writeFileSync(sidecarPath, "A fast car and a small cat in a parking area");

  const result = await analyzeScreenshot(imagePath);
  assert(result.extractedText.includes("car"), "file analysis should include sidecar text");
  assert(result.tags.includes("vehicle"), "file analysis should infer vehicle tag from OCR/sidecar text");
  assert(result.tags.includes("animal"), "file analysis should infer animal tag from OCR/sidecar text");

  fs.rmSync(tempDir, { recursive: true, force: true });
}

async function main(): Promise<void> {
  await testQueryMode();
  await testFileModeWithSidecar();
  console.log("ai tests passed");
}

void main();
