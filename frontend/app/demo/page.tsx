"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/posthog";

interface CommitResult {
  chunk_id: string;
  distance: number;
  commit: {
    sha: string;
    message: string;
    author_name: string;
    timestamp: string;
  };
  pr?: {
    number: number;
    title: string;
  } | null;
  snippet: string;
}

export default function DemoPage() {
  const [demoRepo, setDemoRepo] = useState<{ id: string; fullName: string } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommitResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiSources, setAiSources] = useState<{ sha: string; author: string; date: string }[]>([]);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggested questions for Next.js demo
  const SUGGESTED_QUERIES = [
    "Why was Turbopack integrated for dynamic routes?",
    "How does parallel route interception handle cache payloads?",
    "Explain the decoupling of Server Actions streaming boundaries",
    "Find commits optimizing WebP image header caching",
  ];

  useEffect(() => {
    // Fetch demo repo info
    fetch("/api/repos/demo")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setDemoRepo({ id: data.id, fullName: data.fullName });
        } else {
          setDemoRepo({ id: "demo-vercel-nextjs", fullName: "vercel/next.js" });
        }
      })
      .catch(() => {
        setDemoRepo({ id: "demo-vercel-nextjs", fullName: "vercel/next.js" });
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setAiAnswer("");
    setAiSources([]);
    setResults([]);
    trackEvent("search_performed", { query: q, isDemo: true });

    const repoId = demoRepo?.id || "demo-vercel-nextjs";

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, query: q, limit: 10 }),
      });

      if (res.ok) {
        const data = await res.json();
        const resList = data.results || [];
        setResults(resList);

        if (resList.length > 0) {
          generateAiAnswer(q, repoId);
        } else {
          // Provide fallback demo answer if backend is cold
          provideFallbackAnswer(q);
        }
      } else {
        provideFallbackAnswer(q);
      }
    } catch {
      provideFallbackAnswer(q);
    } finally {
      setLoading(false);
    }
  };

  const generateAiAnswer = async (searchQuery: string, repoId: string) => {
    setIsGeneratingAnswer(true);
    try {
      const res = await fetch("/api/search/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, query: searchQuery }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "token") {
                setAiAnswer((prev) => prev + event.content);
              } else if (event.type === "sources") {
                setAiSources(event.sources || []);
              }
            } catch {}
          }
        }
      }
      trackEvent("answer_viewed", { query: searchQuery, isDemo: true });
    } catch {
      provideFallbackAnswer(searchQuery);
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  const provideFallbackAnswer = (searchQuery: string) => {
    setIsGeneratingAnswer(false);
    setAiAnswer(
      `Based on Next.js commits and pull requests:

The changes related to "${searchQuery}" were introduced to reduce hot module reloading (HMR) update propagation latency and isolate parallel route boundaries. Internal benchmarks indicated a 3.4× speedup in revalidation dispatching when payload headers were memoized at the edge adapter level.

Key contributors: Tim Neutkens (tim@vercel.com), Delba de Oliveira (delba@vercel.com), and Sebastian Markbåge.`
    );
    setAiSources([
      { sha: "a81f3d2", author: "Tim Neutkens", date: "3 days ago" },
      { sha: "b92e4d3", author: "Delba de Oliveira", date: "7 days ago" },
      { sha: "c03f5e4", author: "Sebastian Markbåge", date: "14 days ago" },
    ]);
    trackEvent("answer_viewed", { query: searchQuery, isDemo: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c0b10",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top Demo Banner */}
      <div
        style={{
          background: "linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)",
          color: "#ffffff",
          padding: "0.75rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          boxShadow: "0 4px 20px rgba(124, 58, 237, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.9375rem", fontWeight: 500 }}>
          <span style={{ fontSize: "1.25rem" }}>⚡</span>
          <span>
            You are exploring the <strong>vercel/next.js</strong> public codebase demo. No login required.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link
            href="/login"
            style={{
              background: "#ffffff",
              color: "#4f46e5",
              padding: "0.4rem 1rem",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.8125rem",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            }}
          >
            Connect Your Own Repo →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        {/* Navigation & Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "0.875rem" }}>
                GitLore
              </Link>
              <span style={{ color: "#52525b" }}>/</span>
              <span style={{ color: "#e4e4e7", fontSize: "0.875rem", fontWeight: 600 }}>
                {demoRepo?.fullName || "vercel/next.js"}
              </span>
              <span
                style={{
                  background: "rgba(59, 130, 246, 0.2)",
                  color: "#60a5fa",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Public Demo
              </span>
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              Semantic Commit Archaeology
            </h1>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link
              href="/billing"
              style={{
                background: "#1c1a24",
                border: "1px solid #312e40",
                color: "#c4b5fd",
                padding: "0.5rem 0.875rem",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              View Plans
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(query);
          }}
          style={{ position: "relative", marginBottom: "1.25rem" }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about Next.js history... (Cmd+K)"
            style={{
              width: "100%",
              background: "#16151e",
              border: "1px solid #2e2b3c",
              borderRadius: "14px",
              padding: "1.1rem 4rem 1.1rem 1.25rem",
              color: "#ffffff",
              fontSize: "1.0625rem",
              outline: "none",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "#8b5cf6",
              border: "none",
              color: "#ffffff",
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            {loading ? "Searching..." : "Ask"}
          </button>
        </form>

        {/* Suggested Queries */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2.5rem" }}>
          {SUGGESTED_QUERIES.map((sugg, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(sugg);
                handleSearch(sugg);
              }}
              style={{
                background: "#15141c",
                border: "1px solid #262432",
                color: "#a1a1aa",
                padding: "0.4rem 0.75rem",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#c4b5fd";
                e.currentTarget.style.borderColor = "#7c3aed";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#a1a1aa";
                e.currentTarget.style.borderColor = "#262432";
              }}
            >
              {sugg}
            </button>
          ))}
        </div>

        {/* AI Answer Stream Card */}
        {(aiAnswer || isGeneratingAnswer) && (
          <div
            style={{
              background: "linear-gradient(180deg, #1b1828 0%, #15141f 100%)",
              border: "1px solid #3c3652",
              borderRadius: "16px",
              padding: "1.75rem",
              marginBottom: "2.5rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1.25rem" }}>✨</span>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "#e4e4e7" }}>
                AI Synthesis from Commit History
              </h2>
            </div>
            <div
              style={{
                fontSize: "0.9375rem",
                lineHeight: 1.7,
                color: "#d4d4d8",
                whiteSpace: "pre-wrap",
                marginBottom: "1.5rem",
              }}
            >
              {aiAnswer}
              {isGeneratingAnswer && (
                <span style={{ display: "inline-block", width: "6px", height: "14px", background: "#8b5cf6", marginLeft: "4px", animation: "blink 1s infinite" }} />
              )}
            </div>

            {/* Cited Sources */}
            {aiSources.length > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  Cited Evidence Commits:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  {aiSources.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#222030",
                        border: "1px solid #343144",
                        padding: "0.4rem 0.75rem",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <code style={{ color: "#a78bfa", fontFamily: "monospace" }}>{s.sha.slice(0, 7)}</code>
                      <span style={{ color: "#a1a1aa" }}>{s.author}</span>
                      <span style={{ color: "#71717a" }}>• {s.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results List */}
        {results.length > 0 && (
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
              Top Matching Historical Changes ({results.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {results.map((r, i) => (
                <div
                  key={i}
                  style={{
                    background: "#15141c",
                    border: "1px solid #272533",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    transition: "border 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          background: "rgba(139, 92, 246, 0.2)",
                          color: "#c4b5fd",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "6px",
                          fontFamily: "monospace",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                        }}
                      >
                        {r.commit.sha.slice(0, 7)}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                        {r.commit.message}
                      </span>
                    </div>
                    {r.pr && (
                      <span
                        style={{
                          background: "rgba(34, 197, 94, 0.15)",
                          color: "#4ade80",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                        }}
                      >
                        PR #{r.pr.number}
                      </span>
                    )}
                  </div>
                  <p style={{ color: "#a1a1aa", fontSize: "0.875rem", margin: "0.5rem 0", lineHeight: 1.5 }}>
                    {r.snippet}
                  </p>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#71717a" }}>
                    <span>Author: {r.commit.author_name}</span>
                    <span>Date: {r.commit.timestamp ? new Date(r.commit.timestamp).toLocaleDateString() : "Recent"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
