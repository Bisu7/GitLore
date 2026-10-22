"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/posthog";

interface AvailableRepo {
  githubRepoId: string;
  name: string;
  fullName: string;
  private: boolean;
  language: string | null;
  stargazersCount: number;
  defaultBranch: string;
}

interface UserInfo {
  name?: string;
  email?: string;
  avatarUrl?: string;
}

const FUN_FACTS = [
  "Walking git commit tree and resolving parent DAG shas...",
  "Found 1,247 commits and extracted code change diffs...",
  "Linked 43 Jira & Linear issues from commit messages...",
  "Generating 3,072-dim pgvector embeddings for commit reasoning...",
  "Building Neo4j code graph: Author → Commit → File → Module...",
  "Calculating module state vectors for architectural drift detection...",
  "Indexing pull request discussions and review comments...",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // User state
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Step 2 state
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<AvailableRepo | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Step 3 state
  const [connectedRepoId, setConnectedRepoId] = useState<string | null>(null);
  const [progress, setProgress] = useState(15);
  const [factIndex, setFactIndex] = useState(0);

  // Step 4 state
  const [question, setQuestion] = useState("");
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false);

  // Initial user check
  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await fetch("/api/dashboard/summary");
        if (res.ok) {
          setUser({
            name: "Connected Developer",
            email: "engineer@company.com",
            avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingUser(false);
      }
    };
    checkUser();
  }, []);

  // Fetch available repos when entering Step 2
  useEffect(() => {
    if (step === 2) {
      setLoadingRepos(true);
      fetch("/api/repos/available")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setAvailableRepos(data);
            setSelectedRepo(data[0]);
          } else {
            // Fallback demo repos if GitHub token isn't fully linked
            const fallback: AvailableRepo[] = [
              {
                githubRepoId: "101",
                name: "api-backend",
                fullName: "org/api-backend",
                private: true,
                language: "TypeScript",
                stargazersCount: 24,
                defaultBranch: "main",
              },
              {
                githubRepoId: "102",
                name: "payments-service",
                fullName: "org/payments-service",
                private: true,
                language: "Python",
                stargazersCount: 12,
                defaultBranch: "main",
              },
              {
                githubRepoId: "103",
                name: "web-frontend",
                fullName: "org/web-frontend",
                private: false,
                language: "TypeScript",
                stargazersCount: 156,
                defaultBranch: "main",
              },
            ];
            setAvailableRepos(fallback);
            setSelectedRepo(fallback[0]);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingRepos(false));
    }
  }, [step]);

  // Handle Step 2 Connect
  const handleConnectRepo = async () => {
    if (!selectedRepo) return;
    try {
      const res = await fetch("/api/repos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepoId: selectedRepo.githubRepoId,
          fullName: selectedRepo.fullName,
          defaultBranch: selectedRepo.defaultBranch,
        }),
      });

      if (res.status === 402) {
        // Upgrade needed
        const data = await res.json();
        window.dispatchEvent(
          new CustomEvent("gitlore:upgrade-modal", { detail: data })
        );
        return;
      }

      if (res.ok) {
        const data = await res.json();
        trackEvent("repo_connected", { repo: selectedRepo.fullName });
        setConnectedRepoId(data.repo.id);
        setStep(3);
      } else {
        alert("Failed to connect repository.");
      }
    } catch (e) {
      console.error(e);
      alert("Error connecting repository.");
    }
  };

  // Step 3 Polling & Fun Facts animation
  useEffect(() => {
    if (step !== 3 || !connectedRepoId) return;

    // Cycle fun facts every 3.5s
    const factInterval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 3500);

    // Poll repo status every 2s
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/repos/${connectedRepoId}/status`);
        if (res.ok) {
          const data = await res.json();
          const p = data.ingestionProgress || 0;
          setProgress(Math.max(p, 20));

          if (
            data.ingestionStatus === "COMPLETE" ||
            data.ingestionStatus === "completed" ||
            p >= 100
          ) {
            setProgress(100);
            clearInterval(pollInterval);
            clearInterval(factInterval);
            setTimeout(() => {
              // Pre-fill suggested question for Step 4
              const repoBase = selectedRepo?.name || "codebase";
              setQuestion(`Why was the core architecture in ${repoBase} designed this way?`);
              setStep(4);
            }, 1000);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => {
      clearInterval(factInterval);
      clearInterval(pollInterval);
    };
  }, [step, connectedRepoId, selectedRepo]);

  // Step 4 Finish Onboarding
  const handleFinishOnboarding = async () => {
    setSubmittingOnboarding(true);
    try {
      await fetch("/api/user/onboarding", { method: "POST" });
    } catch {}

    const targetUrl = connectedRepoId
      ? `/repo/${connectedRepoId}/search?q=${encodeURIComponent(question)}`
      : `/dashboard`;
    router.push(targetUrl);
  };

  const filteredRepos = availableRepos.filter((r) =>
    r.fullName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c0b10",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        position: "relative",
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: "680px", position: "relative", zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "1.75rem", fontFamily: "'Instrument Serif', Georgia, serif", color: "#ffffff", letterSpacing: "-0.01em" }}>
            GitLore
          </div>
          <p style={{ color: "#71717a", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Setup your institutional memory in 4 quick steps
          </p>
        </div>

        {/* Stepper Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2.5rem",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "10%",
              right: "10%",
              height: "2px",
              background: "#23212c",
              zIndex: 0,
            }}
          />
          {[
            { num: 1, label: "GitHub" },
            { num: 2, label: "Repository" },
            { num: 3, label: "Indexing" },
            { num: 4, label: "First Query" },
          ].map((s) => {
            const isDone = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div
                key={s.num}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.4rem",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    background: isCurrent ? "#8b5cf6" : isDone ? "#22c55e" : "#1a1922",
                    color: isCurrent || isDone ? "#ffffff" : "#71717a",
                    border: isCurrent ? "2px solid #a78bfa" : "2px solid #282633",
                    transition: "all 0.3s ease",
                  }}
                >
                  {isDone ? "✓" : s.num}
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: isCurrent ? "#e4e4e7" : "#71717a",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Wizard Container Card */}
        <div
          style={{
            background: "#15141c",
            border: "1px solid #272533",
            borderRadius: "16px",
            padding: "2.5rem",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* STEP 1: Connect GitHub */}
          {step === 1 && (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#242230",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.25rem",
                  fontSize: "1.75rem",
                }}
              >
                ⌘
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                Connect your GitHub account
              </h2>
              <p style={{ color: "#a1a1aa", fontSize: "0.9375rem", maxWidth: "460px", margin: "0 auto 2rem" }}>
                GitLore reads your commit logs, diffs, and pull requests to index the architectural rationale behind your code.
              </p>

              {user ? (
                <div
                  style={{
                    background: "#1c1b26",
                    border: "1px solid #302d40",
                    borderRadius: "12px",
                    padding: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "2rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <img
                      src={user.avatarUrl || "https://avatars.githubusercontent.com/u/9919?v=4"}
                      alt="Avatar"
                      style={{ width: "42px", height: "42px", borderRadius: "50%" }}
                    />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{user.name || "GitHub User"}</div>
                      <div style={{ fontSize: "0.8125rem", color: "#22c55e" }}>✓ GitHub connected</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    style={{
                      background: "#8b5cf6",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.625rem 1.25rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    Continue →
                  </button>
                </div>
              ) : (
                <div>
                  <a
                    href="/login"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "#ffffff",
                      color: "#0c0b10",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "10px",
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      textDecoration: "none",
                    }}
                  >
                    <span>Connect with GitHub</span> →
                  </a>
                  <div style={{ marginTop: "1rem" }}>
                    <button
                      onClick={() => setStep(2)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#71717a",
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Already authenticated? Skip to repository selection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Pick a repo */}
          {step === 2 && (
            <div>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                  Pick a repository to index
                </h2>
                <p style={{ color: "#a1a1aa", fontSize: "0.875rem", margin: 0 }}>
                  Select the codebase you want to make searchable.
                </p>
              </div>

              {/* Filter input */}
              <input
                type="text"
                placeholder="Search your repositories..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1c1a24",
                  border: "1px solid #2d2b3b",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  color: "#f4f4f5",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                  outline: "none",
                }}
              />

              {/* Repos list */}
              <div
                style={{
                  maxHeight: "260px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  marginBottom: "1.5rem",
                }}
              >
                {loadingRepos ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#71717a" }}>
                    Loading repositories...
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#71717a" }}>
                    No repositories found matching "{searchFilter}"
                  </div>
                ) : (
                  filteredRepos.map((repo) => {
                    const isSelected = selectedRepo?.githubRepoId === repo.githubRepoId;
                    return (
                      <div
                        key={repo.githubRepoId}
                        onClick={() => setSelectedRepo(repo)}
                        style={{
                          padding: "0.875rem 1rem",
                          borderRadius: "10px",
                          background: isSelected ? "rgba(139, 92, 246, 0.15)" : "#1a1822",
                          border: isSelected ? "1px solid #8b5cf6" : "1px solid #292736",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: isSelected ? "#ffffff" : "#e4e4e7" }}>
                            {repo.fullName}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: "0.2rem" }}>
                            {repo.language || "Unknown"} • {repo.defaultBranch}
                          </div>
                        </div>
                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            border: isSelected ? "5px solid #8b5cf6" : "2px solid #3f3c4f",
                            background: isSelected ? "#ffffff" : "transparent",
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#a1a1aa",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleConnectRepo}
                  disabled={!selectedRepo}
                  style={{
                    background: "#8b5cf6",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    cursor: selectedRepo ? "pointer" : "not-allowed",
                    opacity: selectedRepo ? 1 : 0.5,
                  }}
                >
                  Connect & Start Indexing →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Indexing in progress */}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚡</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                Indexing {selectedRepo?.name || "Codebase"}
              </h2>
              <p style={{ color: "#a1a1aa", fontSize: "0.875rem", marginBottom: "2rem" }}>
                Extracting commits, commit diffs, PR discussions, and vector embeddings.
              </p>

              {/* Animated Progress Bar */}
              <div
                style={{
                  width: "100%",
                  height: "12px",
                  background: "#242230",
                  borderRadius: "9999px",
                  overflow: "hidden",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #8b5cf6, #3b82f6)",
                    borderRadius: "9999px",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "#71717a", marginBottom: "2rem" }}>
                <span>Processing commits</span>
                <span style={{ fontWeight: 600, color: "#e4e4e7" }}>{progress}%</span>
              </div>

              {/* Fun Fact Badge */}
              <div
                style={{
                  background: "#1b1924",
                  border: "1px solid #2e2a3d",
                  borderRadius: "12px",
                  padding: "1rem",
                  color: "#c4b5fd",
                  fontSize: "0.875rem",
                  minHeight: "56px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "monospace",
                }}
              >
                {FUN_FACTS[factIndex]}
              </div>
            </div>
          )}

          {/* STEP 4: Ask your first question */}
          {step === 4 && (
            <div>
              <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                  Indexing complete! Ask your first question
                </h2>
                <p style={{ color: "#a1a1aa", fontSize: "0.875rem", margin: 0 }}>
                  GitLore is ready. Query the institutional memory of your code.
                </p>
              </div>

              {/* Search input */}
              <div style={{ marginBottom: "1.25rem" }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Why was the caching layer added?"
                  style={{
                    width: "100%",
                    background: "#1c1a26",
                    border: "1px solid #3b374d",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    color: "#ffffff",
                    fontSize: "1rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Suggestions Chips */}
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ fontSize: "0.75rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  Suggested queries for {selectedRepo?.name || "your repo"}:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {[
                    `Why was the auth flow updated in ${selectedRepo?.name || "repo"}?`,
                    `Find the commit introducing the rate limiter`,
                    `Who wrote the original database models?`,
                  ].map((sugg, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setQuestion(sugg)}
                      style={{
                        background: "#1a1924",
                        border: "1px solid #2d2b3b",
                        borderRadius: "8px",
                        padding: "0.4rem 0.75rem",
                        color: "#c4b5fd",
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Let's go button */}
              <button
                onClick={handleFinishOnboarding}
                disabled={submittingOnboarding}
                style={{
                  width: "100%",
                  background: "#8b5cf6",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.875rem",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                {submittingOnboarding ? "Entering Search..." : "Let's Go →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
