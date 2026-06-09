"use client";

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SearchPage({ params }: { params: Promise<{ repoId: string }> }) {
  const router = useRouter();
  const { repoId } = use(params);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiSources, setAiSources] = useState<Record<string, string>[]>([]);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setAiAnswer("");
    setAiSources([]);
    setResults([]);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId, query, limit: 10 })
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        
        if (data.results && data.results.length > 0) {
          generateAiAnswer(query);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateAiAnswer = async (searchQuery: string) => {
    setIsGeneratingAnswer(true);
    try {
      const res = await fetch('/api/search/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId, query: searchQuery })
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let currentAnswer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.chunk) {
                    currentAnswer += data.chunk;
                    setAiAnswer(currentAnswer);
                  }
                  if (data.done) {
                    setAiSources(data.sources || []);
                    done = true;
                  }
                  if (data.error) {
                    console.error("AI Generation Error:", data.error);
                    done = true;
                  }
                } catch {
                  // Partial chunk, ignore
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav className="gl-nav">
        <Link href="/" className="gl-wordmark">GitLore</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link href={`/repo/${repoId}`} style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>
            ← Back to Repo
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: "900px", margin: "0 auto", width: "100%", padding: "3rem 2rem" }}>
        
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "2.5rem", color: "#1a1917", marginBottom: "2rem" }}>
          Search {repoId}
        </h1>

        <form onSubmit={handleSearch} style={{ position: "relative", marginBottom: "3rem" }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commits, pull requests, and codebase history..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "1.25rem 1.5rem",
              fontSize: "1.125rem",
              fontFamily: "'Inter', sans-serif",
              border: "1px solid #d8d5cf",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              outline: "none"
            }}
          />
          <div style={{ position: "absolute", right: "1.5rem", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#b8b3ab", background: "#f0ede8", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
              ⌘K
            </span>
            <button 
              type="submit"
              disabled={loading}
              style={{
                background: "#1a1917",
                color: "#fff",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "4px",
                fontFamily: "'Inter', sans-serif",
                cursor: loading ? "wait" : "pointer"
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {(aiAnswer || isGeneratingAnswer) && (
          <div className="gl-card" style={{ marginBottom: "2rem", border: "1px solid #e1dfda", background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span style={{ 
                background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)", 
                WebkitBackgroundClip: "text", 
                WebkitTextFillColor: "transparent",
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "1.25rem"
              }}>✨ AI Answer</span>
              {isGeneratingAnswer && <span className="status-dot amber" style={{ marginLeft: "auto" }}></span>}
            </div>
            
            <div style={{ 
              fontFamily: "'Inter', sans-serif", 
              fontSize: "0.9375rem", 
              color: "#1a1917", 
              lineHeight: 1.6,
              whiteSpace: "pre-wrap"
            }}>
              {aiAnswer}
              {isGeneratingAnswer && <span style={{ display: "inline-block", width: "8px", height: "1em", background: "#1a1917", marginLeft: "4px", animation: "blink 1s step-end infinite" }} />}
            </div>

            {aiSources.length > 0 && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #f0ede8" }}>
                <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#908a82", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  Source Commits
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {aiSources.map((source) => (
                    <Link
                      key={source.sha}
                      href={`/repo/${repoId}/commit/${source.sha.trim()}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#f5f4f0",
                        border: "1px solid #e8e5df",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        textDecoration: "none",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#ebeae4"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#f5f4f0"}
                    >
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#1a1917" }}>
                        {source.sha.trim().substring(0, 7)}
                      </span>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "#5a564f", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {source.message.split('\n')[0]}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {results.length === 0 && !loading && query && !isGeneratingAnswer && (
            <div style={{ textAlign: "center", color: "#908a82", fontFamily: "'Inter', sans-serif", padding: "3rem 0" }}>
              No results found for &quot;{query}&quot;. Try a different term.
            </div>
          )}

          {results.map((result) => {
            const commit = result.commit as Record<string, string>;
            if (!commit) return null;
            
            const shortSha = commit.sha.substring(0, 7);
            const date = new Date(commit.timestamp).toLocaleDateString();

            return (
              <div 
                key={result.id as string} 
                className="gl-card" 
                style={{ 
                  cursor: "pointer", 
                  transition: "transform 0.15s, box-shadow 0.15s",
                  border: "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 16px rgba(26, 25, 23, 0.08)";
                  e.currentTarget.style.border = "1px solid #d8d5cf";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.border = "1px solid transparent";
                }}
                onClick={() => router.push(`/repo/${repoId}/commit/${commit.sha.trim()}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: "1rem", fontWeight: 600, color: "#1a1917" }}>
                    {commit.message.split('\n')[0]}
                  </h3>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#908a82", background: "#f5f4f0", padding: "0.125rem 0.375rem", borderRadius: "3px" }}>
                    {shortSha}
                  </span>
                </div>
                
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#5a564f", marginBottom: "1rem" }}>
                  {commit.authorName} authored on {date}
                </div>
                
                {result.metadata && (
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#908a82", marginBottom: "0.5rem" }}>
                    {Object.entries(result.metadata as Record<string, string>).map(([k,v]) => `${k}: ${v}`).join(' | ')}
                  </div>
                )}
                
                <div style={{ 
                  fontFamily: "ui-monospace, monospace", 
                  fontSize: "0.8125rem", 
                  color: "#5a564f", 
                  background: "#faf9f7", 
                  padding: "1rem", 
                  borderRadius: "4px",
                  borderLeft: "3px solid #d8d5cf",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical"
                }}>
                  {result.content as string}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
