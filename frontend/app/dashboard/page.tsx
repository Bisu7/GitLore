"use client";

import React, { useState } from 'react';

interface GitHubRepo {
  githubRepoId: string;
  name: string;
  fullName: string;
  private: boolean;
  language: string;
  stargazersCount: number;
  defaultBranch: string;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f0db4f", Python: "#3572a5",
  Go: "#00add8", Rust: "#dea584", Java: "#b07219", Ruby: "#701516",
  "C++": "#f34b7d", CSS: "#563d7c", HTML: "#e34c26",
};

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const openModal = async () => {
    setIsModalOpen(true);
    if (availableRepos.length === 0) {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/repos/available');
        if (!res.ok) throw new Error('Failed to fetch repositories. Make sure you are signed in.');
        const data = await res.json();
        setAvailableRepos(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const connectRepo = async (repo: GitHubRepo) => {
    setConnecting(repo.githubRepoId);
    try {
      const res = await fetch('/api/repos/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepoId: repo.githubRepoId,
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
        }),
      });
      if (!res.ok) throw new Error('Failed to connect repository');
      
      const data = await res.json();
      
      setConnectedIds((prev) => new Set([...prev, repo.githubRepoId]));
      
      // Redirect to the newly connected repo dashboard
      if (data.repo && data.repo.id) {
        router.push(`/repo/${data.repo.id}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to connect repository');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav className="gl-nav">
        <a href="/" className="gl-wordmark">GitLore</a>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#908a82", fontFamily: "'Inter', sans-serif" }}>Dashboard</span>
          <button
            onClick={openModal}
            className="btn btn-primary"
          >
            + Connect repo
          </button>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: "1100px", margin: "0 auto", width: "100%", padding: "3rem 2rem" }}>

        {/* Page header */}
        <div style={{ marginBottom: "2.5rem", paddingBottom: "2rem", borderBottom: "1px solid #d8d5cf" }}>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "2rem", color: "#1a1917", marginBottom: "0.375rem" }}>
            Repositories
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>
            Connected repos are indexed and searchable. Click to explore a repo's history.
          </p>
        </div>

        {/* Empty state */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d8d5cf",
            borderRadius: "8px",
            padding: "4rem 2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "#f5f4f0",
              border: "1px solid #d8d5cf",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              fontSize: "1.25rem",
              color: "#908a82",
            }}
          >
            ◈
          </div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "1.4rem",
              color: "#1a1917",
              marginBottom: "0.5rem",
            }}
          >
            No repositories connected yet
          </h2>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.875rem",
              color: "#908a82",
              marginBottom: "2rem",
              maxWidth: "400px",
              margin: "0 auto 2rem",
              lineHeight: 1.65,
            }}
          >
            Connect a GitHub repository to start indexing your commit history, pull requests, and code changes.
          </p>
          <button onClick={openModal} className="btn btn-primary">
            Connect your first repository
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="gl-footer" style={{ marginTop: "auto" }}>
        <span className="gl-wordmark" style={{ fontSize: "1rem" }}>GitLore</span>
        <span style={{ fontFamily: "'Inter', sans-serif" }}>© 2024 GitLore</span>
        <a href="/" style={{ fontFamily: "'Inter', sans-serif", color: "#908a82" }}>Back to home</a>
      </footer>

      {/* Modal */}
      {isModalOpen && (
        <div className="gl-modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="gl-modal">

            {/* Modal header */}
            <div className="gl-modal-header">
              <div>
                <h2
                  style={{
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: "1.25rem",
                    color: "#1a1917",
                    marginBottom: "0.125rem",
                  }}
                >
                  Connect a repository
                </h2>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#908a82" }}>
                  Select a GitHub repository to index
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#908a82",
                  fontSize: "1.25rem",
                  lineHeight: 1,
                  padding: "0.25rem",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="gl-modal-body">
              {isLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 0", gap: "1rem" }}>
                  <div className="gl-spinner"></div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>Fetching your repositories…</p>
                </div>
              ) : error ? (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    padding: "1rem",
                    color: "#9b2c2c",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.875rem",
                  }}
                >
                  {error}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {availableRepos.length === 0 ? (
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82", textAlign: "center", padding: "2rem 0" }}>
                      No repositories found.
                    </p>
                  ) : (
                    availableRepos.map((repo, i) => {
                      const isConnected = connectedIds.has(repo.githubRepoId);
                      const isConnecting = connecting === repo.githubRepoId;
                      const langColor = LANG_COLORS[repo.language] || "#908a82";

                      return (
                        <div
                          key={repo.githubRepoId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.875rem 0",
                            borderBottom: i < availableRepos.length - 1 ? "1px solid #f0ede8" : "none",
                            gap: "1rem",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                marginBottom: "0.25rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "'Inter', sans-serif",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                  color: "#1a1917",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {repo.fullName}
                              </span>
                              {repo.private && (
                                <span className="gl-tag" style={{ fontSize: "0.6875rem" }}>Private</span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                              {repo.language && (
                                <span
                                  style={{
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: "0.75rem",
                                    color: "#5a564f",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                  }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: langColor, display: "inline-block", flexShrink: 0 }}></span>
                                  {repo.language}
                                </span>
                              )}
                              {repo.stargazersCount > 0 && (
                                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "#908a82" }}>
                                  ★ {repo.stargazersCount}
                                </span>
                              )}
                            </div>
                          </div>

                          {isConnected ? (
                            <span
                              style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: "0.8125rem",
                                color: "#2d6a4f",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.375rem",
                                flexShrink: 0,
                              }}
                            >
                              <span className="status-dot green"></span>
                              Connected
                            </span>
                          ) : (
                            <button
                              onClick={() => connectRepo(repo)}
                              disabled={!!connecting}
                              className="btn btn-secondary"
                              style={{
                                flexShrink: 0,
                                opacity: connecting && !isConnecting ? 0.5 : 1,
                                fontSize: "0.8125rem",
                                padding: "0.375rem 0.875rem",
                              }}
                            >
                              {isConnecting ? (
                                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <span className="gl-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }}></span>
                                  Connecting…
                                </span>
                              ) : (
                                "Connect"
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}