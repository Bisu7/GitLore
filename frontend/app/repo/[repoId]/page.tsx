import React from 'react';

export default function RepoPage({ params }: { params: { repoId: string } }) {
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
              {params.repoId}
            </h1>
            <span className="gl-tag">Indexing</span>
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
            <button
              key={tab}
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
              }}
            >
              {tab}
            </button>
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
                <span className="status-dot amber"></span>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "#1a1917" }}>
                  Indexing in progress
                </h3>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#908a82", lineHeight: 1.65 }}>
                GitLore is processing your commit history, pull requests, and code changes. This usually takes 5–15 minutes depending on repository size. You'll be able to search once indexing is complete.
              </p>
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
                {[
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
                        {c.author} · {c.time}
                      </div>
                    </div>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#908a82" }}>{c.sha}</span>
                  </div>
                ))}
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
                  { label: "Status", value: "Indexing" },
                  { label: "Repository", value: params.repoId },
                  { label: "Commits", value: "—" },
                  { label: "Pull requests", value: "—" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#908a82" }}>{row.label}</span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#1a1917", fontWeight: 500 }}>{row.value}</span>
                  </div>
                ))}
              </div>
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
