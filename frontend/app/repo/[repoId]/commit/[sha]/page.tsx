"use client";

import React, { useState, useEffect, use } from 'react';
import Editor from '@monaco-editor/react';

export default function CommitPage({ params }: { params: Promise<{ repoId: string; sha: string }> }) {
  const { repoId, sha } = use(params);
  const [commit, setCommit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/commits/${sha}?repoId=${repoId}`)
      .then(r => r.json())
      .then(data => {
        setCommit(data);
        if (data.files && data.files.length > 0) {
          setSelectedFile(data.files[0]);
        }
        setLoading(false);
      });
  }, [sha, repoId]);

  const handleExplain = async () => {
    setExplaining(true);
    setExplanation('');
    try {
      const res = await fetch(`/api/commits/${sha}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId })
      });
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            setExplanation(prev => prev + decoder.decode(value, { stream: true }));
          }
        }
      }
    } catch (err) {
      setExplanation('Error generating explanation.');
    } finally {
      setExplaining(false);
    }
  };

  if (loading) return <div style={{ padding: '3rem', fontFamily: "'Inter', sans-serif" }}>Loading commit...</div>;
  if (!commit || commit.error) return <div style={{ padding: '3rem', fontFamily: "'Inter', sans-serif" }}>Commit not found</div>;

  const date = new Date(commit.timestamp).toLocaleString();

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav className="gl-nav">
        <a href="/" className="gl-wordmark">GitLore</a>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <a href={`/repo/${repoId}/search`} style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>
            ← Back to Search
          </a>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: "1200px", margin: "0 auto", width: "100%", padding: "3rem 2rem", display: "grid", gridTemplateColumns: "1fr 350px", gap: "2rem" }}>
        
        {/* Left Column - Commit & Code */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div className="gl-card">
            <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "2rem", color: "#1a1917", marginBottom: "1rem", whiteSpace: "pre-wrap" }}>
              {commit.message}
            </h1>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#5a564f" }}>
              <span>{commit.authorName} &lt;{commit.authorEmail}&gt;</span>
              <span>{date}</span>
            </div>
            <div style={{ marginTop: "1rem", fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem", color: "#908a82", background: "#f0ede8", padding: "0.5rem 1rem", borderRadius: "4px", display: "inline-block" }}>
              {commit.sha}
            </div>
          </div>

          {/* AI Explanation Box */}
          <div className="gl-card" style={{ background: "#faf9f7", border: "1px solid #d8d5cf" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: explanation ? "1.5rem" : "0" }}>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: "1rem", fontWeight: 600, color: "#1a1917", margin: 0 }}>
                ✨ AI Commit Summary
              </h3>
              <button 
                onClick={handleExplain}
                disabled={explaining}
                style={{
                  background: explaining ? "#b8b3ab" : "#2d6a4f",
                  color: "#fff",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "4px",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.8125rem",
                  cursor: explaining ? "wait" : "pointer"
                }}
              >
                {explaining ? "Analyzing..." : (explanation ? "Regenerate" : "Explain this commit")}
              </button>
            </div>
            
            {explanation && (
              <div style={{ 
                fontFamily: "'Inter', sans-serif", 
                fontSize: "0.9rem", 
                color: "#1a1917", 
                lineHeight: 1.6,
                background: "#fff",
                padding: "1.5rem",
                borderRadius: "6px",
                border: "1px solid #e8e5df",
                whiteSpace: "pre-wrap"
              }}>
                {explanation}
              </div>
            )}
          </div>

          {/* Files / Diff Editor */}
          <div className="gl-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1px solid #d8d5cf", background: "#faf9f7" }}>
              <div style={{ width: "250px", borderRight: "1px solid #d8d5cf", padding: "1rem", background: "#fff" }}>
                <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#908a82", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                  Files Changed ({commit.files?.length || 0})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {commit.files?.map((f: any) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFile(f)}
                      style={{
                        textAlign: "left",
                        background: selectedFile?.id === f.id ? "#f0ede8" : "transparent",
                        border: "none",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.75rem",
                        color: selectedFile?.id === f.id ? "#1a1917" : "#5a564f",
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {f.filePath}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, height: "600px", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "0.75rem 1rem", background: "#1a1917", color: "#fff", fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>
                  {selectedFile ? selectedFile.filePath : "No file selected"}
                </div>
                <div style={{ flex: 1 }}>
                  {selectedFile ? (
                    <Editor
                      height="100%"
                      defaultLanguage="diff"
                      theme="vs-dark"
                      value={selectedFile.patch || "// No diff content available"}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
                      }}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#908a82", fontFamily: "'Inter', sans-serif" }}>
                      Select a file to view changes
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - PR Context */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {commit.prs?.length > 0 ? (
            commit.prs.map((pr: any) => (
              <div key={pr.id} className="gl-card">
                <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#908a82", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                  Linked Pull Request #{pr.githubPrNumber}
                </h4>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: "1rem", fontWeight: 600, color: "#1a1917", marginBottom: "0.5rem" }}>
                  {pr.title}
                </h3>
                <div style={{ display: "inline-block", background: pr.state === "closed" ? "#fbe8e8" : "#e8f4ee", color: pr.state === "closed" ? "#9b2c2c" : "#2d6a4f", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: "1rem", textTransform: "capitalize" }}>
                  {pr.state}
                </div>
                {pr.body && (
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#5a564f", lineHeight: 1.6, marginBottom: "1.5rem", whiteSpace: "pre-wrap" }}>
                    {pr.body}
                  </p>
                )}

                {pr.comments?.length > 0 && (
                  <div>
                    <h5 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", fontWeight: 600, color: "#1a1917", borderBottom: "1px solid #e8e5df", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
                      Review Comments ({pr.comments.length})
                    </h5>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {pr.comments.map((comment: any) => (
                        <div key={comment.id} style={{ background: "#faf9f7", padding: "1rem", borderRadius: "6px", border: "1px solid #e8e5df" }}>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#1a1917", marginBottom: "0.5rem" }}>
                            {comment.authorLogin}
                          </div>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#5a564f", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {comment.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="gl-card">
              <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "#908a82", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                Pull Requests
              </h4>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#908a82" }}>
                No pull requests linked to this commit.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
