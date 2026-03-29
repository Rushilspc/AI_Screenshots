import fs from "node:fs";
import path from "node:path";
import { buildHashEmbedding, tokenize } from "./ranking";
import { extractTextFromImage } from "./ocr";

export interface AnalysisResult {
  extractedText: string;
  tags: string[];
  embedding: number[];
  sensitiveRanges: Array<{ start: number; end: number; type: string }>;
}

const SENSITIVE_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "api_key", regex: /\b(?:sk|pk)_[A-Za-z0-9]{16,}\b/g },
  { type: "token", regex: /\b(?:bearer\s+)?[A-Za-z0-9-_]{24,}\.[A-Za-z0-9-_]{6,}\.[A-Za-z0-9-_]{10,}\b/gi },
  { type: "card", regex: /\b(?:\d[ -]*?){13,19}\b/g },
  { type: "password_hint", regex: /\b(password|passwd|pwd)\b[:=]?\s*\S+/gi }
];

export async function analyzeScreenshot(filePathOrQuery: string): Promise<AnalysisResult> {
  const extractedText = await buildLocalSearchableText(filePathOrQuery);
  const tags = inferTags(extractedText);
  const embedding = buildHashEmbedding(extractedText, 384);
  const sensitiveRanges = detectSensitiveRanges(extractedText);

  return {
    extractedText,
    tags,
    embedding,
    sensitiveRanges
  };
}

async function buildLocalSearchableText(filePathOrQuery: string): Promise<string> {
  const candidatePath = filePathOrQuery.trim();
  if (!looksLikePath(candidatePath) || !fs.existsSync(candidatePath)) {
    return filePathOrQuery.toLowerCase();
  }

  const baseName = path.basename(candidatePath, path.extname(candidatePath)).toLowerCase();
  const fromSidecar = readSidecarText(candidatePath);
  const fromOcr = isImageFile(candidatePath) ? await extractTextFromImage(candidatePath) : "";

  const joined = [baseName, fromSidecar, fromOcr].filter(Boolean).join(" ");
  const normalized = joined
    .replace(/[_\-.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : baseName;
}

function readSidecarText(imagePath: string): string {
  const candidates = [`${imagePath}.txt`, imagePath.replace(/\.[^.]+$/, ".txt")];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return fs.readFileSync(candidate, "utf8").slice(0, 12000);
    } catch {
      // ignore invalid sidecar and continue
    }
  }
  return "";
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || /\.[a-zA-Z]{2,5}$/.test(value);
}

function isImageFile(filePath: string): boolean {
  return /\.(png|jpg|jpeg|bmp|webp|tiff?)$/i.test(filePath);
}

function inferTags(text: string): string[] {
  const tags = new Set<string>();
  const lower = text.toLowerCase();
  if (/(error|exception|stack trace|traceback|failed|failure)/.test(lower)) tags.add("error");
  if (/(react|function|class|const|import|terminal|python|java|typescript|node)/.test(lower)) tags.add("code");
  if (/(chrome|edge|firefox|browser|url|http)/.test(lower)) tags.add("browser");
  if (/(vscode|intellij|pycharm|visual studio|ide)/.test(lower)) tags.add("ide");
  if (/(meeting|slide|presentation|agenda)/.test(lower)) tags.add("meeting");
  if (/(invoice|payment|amount|tax|receipt)/.test(lower)) tags.add("finance");

  // Lightweight object text cues from OCR output.
  if (/(car|vehicle|truck|bus|bike|motorcycle)/.test(lower)) tags.add("vehicle");
  if (/(cat|dog|bird|animal)/.test(lower)) tags.add("animal");

  if (tags.size === 0) {
    const tokenCount = tokenize(lower).length;
    tags.add(tokenCount > 8 ? "document" : "general");
  }
  return Array.from(tags);
}

function detectSensitiveRanges(text: string): Array<{ start: number; end: number; type: string }> {
  const ranges: Array<{ start: number; end: number; type: string }> = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      if (match.index === undefined) continue;
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
        type: pattern.type
      });
    }
  }
  return ranges;
}
