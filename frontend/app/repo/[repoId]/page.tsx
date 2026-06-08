"use client";

import React, { useState, useEffect, use } from 'react';

export default function RepoPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('PENDING');
  const [repoName, setRepoName] = useState<string>(repoId);
  const [recentCommits, setRecentCommits] = useState<any[]>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/repos/${repoId}/status?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setStatus(data.ingestionStatus);
          setProgress(data.ingestionProgress);
          if (data.fullName) setRepoName(data.fullName);
          if (data.commits) setRecentCommits(data.commits);
          
          if (data.ingestionStatus === 'COMPLETE') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to fetch status', err);
      }
    };

    fetchStatus(); // initial fetch
    
    interval = setInterval(() => {
      if (status !== 'COMPLETE' && status !== 'FAILED') {
        fetchStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [repoId, status]);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav className="gl-nav">
        <a href="/" className="gl-wordmark">GitLore</a>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <a href="/dashboard" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>
            ← Dashboard
          </a>
        </div>
      </nav>

      {/* Repo header */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #d8d5cf",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <span style={{ color: "#908a82", fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem" }}>
              <a href="/dashboard" style={{ color: "#908a82" }}>Repositories</a>
              {" / "}
            </span>
            <h1
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "1.5rem",
                color: "#1a1917",
              }}
            >
              {repoName}
            </h1>
            <span className="gl-tag">{status === 'COMPLETE' ? 'Indexed' : status === 'FAILED' ? 'Failed' : 'Indexing'}</span>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>
            Repository details and history search
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #d8d5cf" }}>
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "0 2rem",
            display: "flex",
            gap: "0",
          }}
        >
          {["Overview", "Commits", "Pull Requests", "Search"].map((tab, i) => (
            <a
              key={tab}
              href={tab === "Search" ? `/repo/${repoId}/search` : tab === "Overview" ? `/repo/${repoId}` : `#`}
              style={{
                background: "none",
                border: "none",
                borderBottom: i === 0 ? "2px solid #1a1917" : "2px solid transparent",
                padding: "0.875rem 1.25rem",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.875rem",
                fontWeight: i === 0 ? 500 : 400,
                color: i === 0 ? "#1a1917" : "#908a82",
                cursor: "pointer",
                transition: "color 0.15s",
                textDecoration: "none",
                display: "block"
              }}
            >
              {tab}
            </a>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: "1100px", margin: "0 auto", width: "100%", padding: "2.5rem 2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "2rem" }}>

          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Indexing status card */}
            <div className="gl-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span className={`status-dot ${status === 'COMPLETE' ? 'green' : status === 'FAILED' ? 'red' : 'amber'}`}></span>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "#1a1917" }}>
                  {status === 'COMPLETE' ? 'Indexing complete' : status === 'FAILED' ? 'Indexing failed' : 'Indexing in progress'}
                </h3>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#908a82", lineHeight: 1.65, marginBottom: "1rem" }}>
                {status === 'COMPLETE' 
                  ? 'GitLore has successfully processed your commit history, pull requests, and code changes. You can now search your repository.'
                  : 'GitLore is processing your commit history, pull requests, and code changes. This usually takes 5–15 minutes depending on repository size. You\'ll be able to search once indexing is complete.'}
              </p>
              
              {/* Progress Bar */}
              <div style={{ width: '100%', background: '#e8e5df', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${progress}%`, 
                    background: status === 'COMPLETE' ? 'var(--green)' : status === 'FAILED' ? 'var(--red)' : '#b45309', 
                    transition: 'width 0.5s ease-out',
                  }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#908a82', fontFamily: "'Inter', sans-serif" }}>{progress}%</span>
                {status !== 'COMPLETE' && status !== 'FAILED' && (
                  <span style={{ fontSize: '0.75rem', color: '#908a82', fontFamily: "'Inter', sans-serif" }}>Processing...</span>
                )}
              </div>
            </div>

            {/* Recent commits placeholder */}
            <div className="gl-card">
              <h3
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "1.15rem",
                  color: "#1a1917",
                  marginBottom: "1.25rem",
                }}
              >
                Recent commits
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {status !== 'COMPLETE' && recentCommits.length === 0 ? (
                  [
                    { msg: "Awaiting index…", sha: "—", author: "—", time: "—" },
                    { msg: "Awaiting index…", sha: "—", author: "—", time: "—" },
                    { msg: "Awaiting index…", sha: "—", author: "—", time: "—" },
                  ].map((c, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.875rem 0",
                        borderBottom: i < 2 ? "1px solid #f0ede8" : "none",
                        opacity: 0.45,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#1a1917", marginBottom: "0.25rem" }}>
                          {c.msg}
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "#908a82" }}>
                          {`${c.author} · ${c.time}`}
                        </div>
                      </div>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#908a82" }}>
                        {c.sha}
                      </span>
                    </div>
                  ))
                ) : (
                  recentCommits.map((c, i) => (
                    <a
                      key={c.sha}
                      href={`/repo/${repoId}/commit/${c.sha}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.875rem 0",
                        borderBottom: i < recentCommits.length - 1 ? "1px solid #f0ede8" : "none",
                        textDecoration: "none"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: "1rem" }}>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#1a1917", marginBottom: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.message.split('\n')[0]}
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "#908a82" }}>
                          {`${c.authorName || 'Unknown'} · ${new Date(c.timestamp).toLocaleDateString()}`}
                        </div>
                      </div>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#908a82", flexShrink: 0 }}>
                        {c.sha.substring(0, 7)}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right column — sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="gl-card">
              <h4
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#908a82",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "1rem",
                }}
              >
                About
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  { label: "Status", value: status },
                  { label: "Repository", value: repoName },
                  { label: "Commits", value: status === 'COMPLETE' ? "Indexed" : "—" },
                  { label: "Pull requests", value: status === 'COMPLETE' ? "Indexed" : "—" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#908a82" }}>{row.label}</span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#1a1917", fontWeight: 500 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Link to Search Page */}
            <div className="gl-card" style={{ background: "#faf9f7", border: "1px solid #d8d5cf", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "#1a1917", margin: 0 }}>
                Explore History
              </h4>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#5a564f", margin: 0, lineHeight: 1.5 }}>
                Use natural language to search through every commit, pull request, and code change via AI embeddings.
              </p>
              <a 
                href={`/repo/${repoId}/search`}
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  background: status === 'COMPLETE' ? "#1a1917" : "#d8d5cf",
                  color: "#fff",
                  padding: "0.625rem 1rem",
                  borderRadius: "4px",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  pointerEvents: status === 'COMPLETE' ? 'auto' : 'none'
                }}
              >
                Open Semantic Search
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="gl-footer">
        <span className="gl-wordmark" style={{ fontSize: "1rem" }}>GitLore</span>
        <span style={{ fontFamily: "'Inter', sans-serif" }}>© 2024 GitLore</span>
        <a href="/" style={{ fontFamily: "'Inter', sans-serif", color: "#908a82" }}>Back to home</a>
      </footer>
    </div>
  );
}
