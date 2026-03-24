import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { ScreenshotRecord } from "../shared/types";
import { cosineSimilarity, toFtsQuery } from "./ranking";

export class ScreenshotDatabase {
  private db: Database;

  constructor() {
    const dataDir = path.join(app.getPath("userData"), "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "screenshots.db");
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        preview_path TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        source TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        embedding_json TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS screenshots_fts USING fts5(
        extracted_text,
        tags,
        content='screenshots',
        content_rowid='id'
      );
      CREATE TRIGGER IF NOT EXISTS screenshots_ai AFTER INSERT ON screenshots BEGIN
        INSERT INTO screenshots_fts(rowid, extracted_text, tags)
        VALUES (new.id, new.extracted_text, json_extract(new.tags_json, '$'));
      END;
      CREATE TRIGGER IF NOT EXISTS screenshots_ad AFTER DELETE ON screenshots BEGIN
        INSERT INTO screenshots_fts(screenshots_fts, rowid, extracted_text, tags)
        VALUES('delete', old.id, old.extracted_text, json_extract(old.tags_json, '$'));
      END;
      CREATE TRIGGER IF NOT EXISTS screenshots_au AFTER UPDATE ON screenshots BEGIN
        INSERT INTO screenshots_fts(screenshots_fts, rowid, extracted_text, tags)
        VALUES('delete', old.id, old.extracted_text, json_extract(old.tags_json, '$'));
        INSERT INTO screenshots_fts(rowid, extracted_text, tags)
        VALUES (new.id, new.extracted_text, json_extract(new.tags_json, '$'));
      END;
    `);
  }

  upsert(record: Omit<ScreenshotRecord, "id" | "score">): number {
    const stmt = this.db.prepare(`
      INSERT INTO screenshots (file_path, preview_path, captured_at, source, extracted_text, tags_json, embedding_json)
      VALUES (@filePath, @previewPath, @capturedAt, @source, @extractedText, @tagsJson, @embeddingJson)
      ON CONFLICT(file_path) DO UPDATE SET
        preview_path=excluded.preview_path,
        captured_at=excluded.captured_at,
        source=excluded.source,
        extracted_text=excluded.extracted_text,
        tags_json=excluded.tags_json,
        embedding_json=excluded.embedding_json
      RETURNING id;
    `);

    const row = stmt.get({
      filePath: record.filePath,
      previewPath: record.previewPath,
      capturedAt: record.capturedAt,
      source: record.source,
      extractedText: record.extractedText,
      tagsJson: JSON.stringify(record.tags),
      embeddingJson: JSON.stringify(record.embedding)
    }) as { id: number };

    return row.id;
  }

  search(query: string, queryEmbedding: number[], limit = 5): ScreenshotRecord[] {
    const ftsQuery = toFtsQuery(query);
    let rows: DbRow[] = [];

    if (ftsQuery) {
      const ftsStmt = this.db.prepare(`
        SELECT id, file_path, preview_path, captured_at, source, extracted_text, tags_json, embedding_json
        FROM screenshots
        WHERE id IN (
          SELECT rowid
          FROM screenshots_fts
          WHERE screenshots_fts MATCH ?
          LIMIT 500
        )
        ORDER BY captured_at DESC
        LIMIT 500
      `);

      try {
        rows = ftsStmt.all(ftsQuery) as DbRow[];
      } catch {
        rows = [];
      }
    }

    if (rows.length === 0) {
      const fallbackStmt = this.db.prepare(`
        SELECT id, file_path, preview_path, captured_at, source, extracted_text, tags_json, embedding_json
        FROM screenshots
        ORDER BY captured_at DESC
        LIMIT 1200
      `);
      rows = fallbackStmt.all() as DbRow[];
    }

    return rows
      .map((row) => {
        const embedding = JSON.parse(row.embedding_json) as number[];
        const semanticScore = cosineSimilarity(queryEmbedding, embedding);
        const lexicalBoost = row.extracted_text.toLowerCase().includes(query.toLowerCase()) ? 0.35 : 0;
        const score = semanticScore + lexicalBoost;
        return {
          id: row.id,
          filePath: row.file_path,
          previewPath: row.preview_path,
          capturedAt: row.captured_at,
          source: row.source,
          extractedText: row.extracted_text,
          tags: JSON.parse(row.tags_json) as string[],
          embedding,
          score
        };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) as count FROM screenshots").get() as { count: number }).count;
  }
}

type DbRow = {
  id: number;
  file_path: string;
  preview_path: string;
  captured_at: string;
  source: string;
  extracted_text: string;
  tags_json: string;
  embedding_json: string;
};
