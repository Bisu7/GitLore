"use client";

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchPage({ params }: { params: Promise<{ repoId: string }> }) {
  const router = useRouter();
  const { repoId } = use(params);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId, query, limit: 10 })
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav className="gl-nav">
        <a href="/" className="gl-wordmark">GitLore</a>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <a href={`/repo/${repoId}`} style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>
            ← Back to Repo
          </a>
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

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {results.length === 0 && !loading && query && (
            <div style={{ textAlign: "center", color: "#908a82", fontFamily: "'Inter', sans-serif", padding: "3rem 0" }}>
              No results found for "{query}". Try a different term.
            </div>
          )}

          {results.map((result, i) => {
            const commit = result.commit;
            if (!commit) return null;
            
            const shortSha = commit.sha.substring(0, 7);
            const date = new Date(commit.timestamp).toLocaleDateString();

            return (
              <div 
                key={result.id} 
                onClick={() => router.push(`/repo/${repoId}/commit/${commit.sha}`)}
                className="gl-card"
                style={{ cursor: "pointer", transition: "transform 0.1s, box-shadow 0.1s" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: "1rem", fontWeight: 600, color: "#1a1917", margin: 0, paddingRight: "1rem" }}>
                    {commit.message.split('\n')[0]}
                  </h3>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem", color: "#908a82", background: "#f5f4f0", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                    {shortSha}
                  </span>
                </div>
                
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#5a564f", marginBottom: "1rem" }}>
                  {commit.authorName} committed on {date}
                </div>
                
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
                  {result.content}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
