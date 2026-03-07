import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CaptureMode, ScreenshotRecord } from "../shared/types";
import "./styles.css";

function App(): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScreenshotRecord[]>([]);
  const [stats, setStats] = useState({ totalScreenshots: 0, queuedJobs: 0, avgProcessingMs: 0 });
  const [isSearching, setIsSearching] = useState(false);

  const processingText = useMemo(() => {
    if (stats.avgProcessingMs === 0) return "Calibrating";
    return `${(stats.avgProcessingMs / 1000).toFixed(2)}s avg`;
  }, [stats.avgProcessingMs]);

  async function refreshStats(): Promise<void> {
    const latest = await window.aiScreenshots.stats();
    setStats(latest);
  }

  useEffect(() => {
    void refreshStats();
    window.aiScreenshots.onRefresh(() => {
      void refreshStats();
      if (query.trim()) {
        void performSearch(query);
      }
    });
  }, []);

  async function performSearch(value: string): Promise<void> {
    setIsSearching(true);
    const payload = await window.aiScreenshots.search(value);
    setResults(payload.results);
    setIsSearching(false);
  }

  async function triggerCapture(mode: CaptureMode): Promise<void> {
    await window.aiScreenshots.capture(mode, "high");
    await refreshStats();
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>AI Screenshots</h1>
        <p>Offline searchable screenshot memory for Windows.</p>
      </header>

      <section className="toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type what you remember..."
        />
        <button onClick={() => void performSearch(query)} disabled={!query.trim() || isSearching}>
          {isSearching ? "Searching..." : "Search Top 5"}
        </button>
      </section>

      <section className="actions">
        <button onClick={() => void triggerCapture("region")}>Capture Region</button>
        <button onClick={() => void triggerCapture("fullscreen")}>Capture Fullscreen</button>
        <button onClick={() => void triggerCapture("window")}>Capture Window</button>
      </section>

      <section className="stats">
        <div><strong>{stats.totalScreenshots}</strong><span>Indexed Screenshots</span></div>
        <div><strong>{stats.queuedJobs}</strong><span>Queued Jobs</span></div>
        <div><strong>{processingText}</strong><span>Processing Speed</span></div>
      </section>

      <section className="results">
        {results.length === 0 ? (
          <p className="empty">No results yet. Capture or import screenshots to begin.</p>
        ) : (
          results.map((item) => (
            <article className="card" key={item.id}>
              <img src={`file://${item.previewPath}`} alt="screenshot preview" />
              <div className="meta">
                <h3>{new Date(item.capturedAt).toLocaleString()}</h3>
                <p>{item.extractedText.slice(0, 180)}</p>
                <small>Tags: {item.tags.join(", ")}</small>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
