"use client";

import { useEffect, useState } from "react";

const FEATURES = [
  {
    icon: "⌘",
    title: "Commit archaeology",
    body: "Trace any line of code back to its original commit, author, and the ticket that created it. No more git blame rabbit holes.",
  },
  {
    icon: "⊕",
    title: "Pull request context",
    body: "Every PR, its comments, reviews, and decisions are indexed and searchable. The conversation lives alongside the code.",
  },
  {
    icon: "◈",
    title: "Semantic search",
    body: "Ask questions in plain English. \"Why was the rate limiter added?\" — GitLore finds the answer from your actual history.",
  },
  {
    icon: "⊗",
    title: "Ticket linkage",
    body: "Automatically connects commits to Jira, Linear, and GitHub Issues. Business context attached to every change.",
  },
  {
    icon: "⊞",
    title: "Diff embeddings",
    body: "Every code change is embedded as a vector. Find similar past changes, regressions, and patterns across your entire history.",
  },
  {
    icon: "⊠",
    title: "Team knowledge",
    body: "When someone leaves, their knowledge stays. GitLore preserves the institutional memory that usually walks out the door.",
  },
];

const STATS = [
  { value: "100%", label: "of context preserved" },
  { value: "< 2s", label: "average search time" },
  { value: "∞", label: "history depth" },
  { value: "0", label: "tribal knowledge lost" },
];

const TESTIMONIALS = [
  {
    quote: "We onboard engineers 3× faster now. Instead of pinging five people, they just ask GitLore why something was built a certain way.",
    name: "Priya Mehta",
    role: "Engineering Lead, Razorpay",
  },
  {
    quote: "Our codebase is 8 years old. GitLore is the first tool that made the history actually usable.",
    name: "Tom Fischer",
    role: "Staff Engineer, Notion",
  },
  {
    quote: "Debugging a production incident used to take hours of git archeology. Now it takes minutes.",
    name: "Amara Osei",
    role: "Principal Engineer, Stripe",
  },
];

const FAQ = [
  {
    q: "What version control systems does GitLore support?",
    a: "Currently GitHub (public and private repos). GitLab and Bitbucket support are on the roadmap for Q3.",
  },
  {
    q: "Is my code stored on your servers?",
    a: "Only the diff metadata, commit messages, PR descriptions, and comments are indexed. Raw source code is never stored.",
  },
  {
    q: "How long does initial indexing take?",
    a: "A typical repo with 5,000 commits takes 8–12 minutes to fully index. You can start searching immediately as it processes.",
  },
  {
    q: "Can I use this for a monorepo?",
    a: "Yes. GitLore handles monorepos well. You can filter search results by subdirectory or package.",
  },
];

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Loading screen */}
      <div id="gl-loader" className={loaded ? "hidden" : ""}>
        <div style={{ textAlign: "center" }}>
          <div className="loader-wordmark">GitLore</div>
          <div className="loader-bar"></div>
        </div>
      </div>

      {/* Nav */}
      <nav className="gl-nav">
        <a href="/" className="gl-wordmark">GitLore</a>
        <ul className="gl-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="/login" className="btn btn-primary" style={{ padding: "0.375rem 0.875rem" }}>Sign in</a></li>
        </ul>
      </nav>

      {/* Hero */}
      <section
        style={{
          position: "relative",
          minHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "6rem 2rem",
          overflow: "hidden",
          background: "#1a1917",
          color: "#f5f4f0",
          textAlign: "center",
        }}
      >
        {/* Background image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/hero_bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.35,
          }}
        />
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, transparent 40%, #1a1917 100%)",
          }}
        />

        <div style={{ position: "relative", maxWidth: "820px" }}>
          <div className="gl-tag" style={{ marginBottom: "2rem", background: "rgba(245,244,240,0.1)", border: "1px solid rgba(245,244,240,0.2)", color: "#c9c4bb" }}>
            Now available — connect your GitHub repos
          </div>
          <h1
            style={{
              fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#f5f4f0",
              marginBottom: "1.75rem",
            }}
          >
            Your codebase has
            <br />
            <em style={{ fontStyle: "italic", color: "#c9c4bb" }}>a memory problem.</em>
          </h1>
          <p
            style={{
              fontSize: "1.125rem",
              color: "#908a82",
              maxWidth: "560px",
              margin: "0 auto 2.5rem",
              lineHeight: 1.7,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
            }}
          >
            GitLore turns your Git history, pull requests, and commit messages into a searchable institutional knowledge base. Understand <em>why</em> every line of code exists.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/login"
              className="btn btn-primary"
              style={{ background: "#f5f4f0", color: "#1a1917", borderColor: "#f5f4f0", padding: "0.75rem 1.75rem", fontSize: "0.9375rem" }}
            >
              Connect your first repo →
            </a>
            <a
              href="#how-it-works"
              className="btn"
              style={{ background: "transparent", color: "#908a82", border: "1px solid rgba(245,244,240,0.2)", padding: "0.75rem 1.75rem", fontSize: "0.9375rem" }}
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "2.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            color: "#5a564f",
            fontSize: "0.75rem",
            fontFamily: "'Inter', sans-serif",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span>Scroll</span>
          <span style={{ fontSize: "1rem" }}>↓</span>
        </div>
      </section>

      {/* Stats bar */}
      <div
        style={{
          background: "#f5f4f0",
          borderBottom: "1px solid #d8d5cf",
          borderTop: "1px solid #d8d5cf",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "2.5rem 2rem",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "2rem",
            textAlign: "center",
          }}
        >
          {STATS.map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "2.5rem",
                  letterSpacing: "-0.02em",
                  color: "#1a1917",
                  lineHeight: 1,
                  marginBottom: "0.5rem",
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#908a82", fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <section id="features" className="gl-section">
        <div style={{ maxWidth: "560px", marginBottom: "4rem" }}>
          <p style={{ fontSize: "0.8125rem", color: "#908a82", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter', sans-serif", marginBottom: "1rem" }}>
            Features
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1917", marginBottom: "1rem" }}>
            Built for codebases that have been around a while
          </h2>
          <p style={{ color: "#5a564f", lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>
            Most tools treat your history as a log. GitLore treats it as a knowledge graph.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px",
            background: "#d8d5cf",
            border: "1px solid #d8d5cf",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "#ffffff",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontSize: "1.25rem", color: "#5a564f" }}>{f.icon}</span>
              <h3
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "1.2rem",
                  color: "#1a1917",
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#5a564f", lineHeight: 1.65, fontFamily: "'Inter', sans-serif" }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <hr className="gl-divider" />

      {/* How it works */}
      <section id="how-it-works" className="gl-section">
        <p style={{ fontSize: "0.8125rem", color: "#908a82", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter', sans-serif", marginBottom: "1rem" }}>
          How it works
        </p>
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1917", marginBottom: "4rem", maxWidth: "480px" }}>
          Three steps, then it just works
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "3rem",
          }}
        >
          {[
            { n: "01", title: "Connect your repo", body: "Link your GitHub repository. GitLore reads your history — never your source code." },
            { n: "02", title: "We index your history", body: "Commits, PRs, reviews, and comments are parsed, linked, and embedded into our search index." },
            { n: "03", title: "Ask questions", body: "Search with natural language or browse by author, file, or date range. The answers are already there." },
          ].map((step) => (
            <div key={step.n}>
              <div
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "3.5rem",
                  color: "#e8e5df",
                  lineHeight: 1,
                  marginBottom: "1.25rem",
                  letterSpacing: "-0.02em",
                }}
              >
                {step.n}
              </div>
              <h3
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "1.35rem",
                  color: "#1a1917",
                  marginBottom: "0.75rem",
                }}
              >
                {step.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#5a564f", lineHeight: 1.65, fontFamily: "'Inter', sans-serif" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <hr className="gl-divider" />

      {/* Terminal demo strip */}
      <section
        style={{
          background: "#1a1917",
          padding: "5rem 2rem",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p style={{ fontSize: "0.8125rem", color: "#5a564f", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter', sans-serif", marginBottom: "1rem", textAlign: "center" }}>
            Real answers from real history
          </p>
          <h2
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              color: "#f5f4f0",
              textAlign: "center",
              marginBottom: "3rem",
            }}
          >
            "Why does the payment service retry 3 times?"
          </h2>
          <div
            style={{
              background: "#0f0e0d",
              border: "1px solid #2d2926",
              borderRadius: "8px",
              overflow: "hidden",
              fontFamily: "ui-monospace, 'SF Mono', 'Fira Code', monospace",
            }}
          >
            <div
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #2d2926",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3a3835", display: "inline-block" }}></span>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3a3835", display: "inline-block" }}></span>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3a3835", display: "inline-block" }}></span>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <div style={{ color: "#5a564f", fontSize: "0.8125rem", marginBottom: "1rem" }}>$ gitlore ask "why does payment retry 3 times?"</div>
              <div style={{ color: "#c9c4bb", fontSize: "0.875rem", lineHeight: 1.8 }}>
                <div style={{ marginBottom: "1rem" }}>
                  <span style={{ color: "#5a564f" }}>→ </span>Found in PR <span style={{ color: "#f5f4f0" }}>#1482</span> by <span style={{ color: "#f5f4f0" }}>@anjali.rk</span> — merged 14 Jan 2023
                </div>
                <div
                  style={{
                    background: "#1a1917",
                    border: "1px solid #2d2926",
                    borderLeft: "2px solid #5a564f",
                    padding: "0.875rem 1rem",
                    marginBottom: "1rem",
                    borderRadius: "0 4px 4px 0",
                  }}
                >
                  "Changed retry count to 3 after the Dec incident. Razorpay was returning 502s intermittently during high load. 1 retry wasn't enough, 5 was too aggressive and caused duplicate charges in edge cases. Post-mortem in JIRA-4821."
                </div>
                <div style={{ color: "#5a564f", fontSize: "0.8125rem" }}>
                  Also referenced in: <span style={{ color: "#908a82" }}>JIRA-4821, commit a3f91c2, PR #1489 (rollback attempt)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="gl-divider" />

      {/* Testimonials */}
      <section className="gl-section">
        <p style={{ fontSize: "0.8125rem", color: "#908a82", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter', sans-serif", marginBottom: "3rem", textAlign: "center" }}>
          What teams are saying
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="gl-card">
              <p
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "1.05rem",
                  lineHeight: 1.6,
                  color: "#1a1917",
                  marginBottom: "1.5rem",
                }}
              >
                "{t.quote}"
              </p>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1a1917", fontFamily: "'Inter', sans-serif" }}>{t.name}</div>
                <div style={{ fontSize: "0.8125rem", color: "#908a82", fontFamily: "'Inter', sans-serif" }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="gl-divider" />

      {/* FAQ */}
      <section id="pricing" className="gl-section">
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <p style={{ fontSize: "0.8125rem", color: "#908a82", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter', sans-serif", marginBottom: "1rem" }}>
            FAQ
          </p>
          <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "#1a1917", marginBottom: "3rem" }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {FAQ.map((item, i) => (
              <div
                key={item.q}
                style={{
                  borderTop: "1px solid #d8d5cf",
                  ...(i === FAQ.length - 1 ? { borderBottom: "1px solid #d8d5cf" } : {}),
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1.25rem 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "#1a1917",
                    textAlign: "left",
                    gap: "1rem",
                  }}
                >
                  {item.q}
                  <span style={{ fontSize: "1.25rem", flexShrink: 0, color: "#908a82", fontFamily: "monospace" }}>
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && (
                  <p
                    style={{
                      paddingBottom: "1.25rem",
                      fontSize: "0.875rem",
                      color: "#5a564f",
                      lineHeight: 1.7,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: "#1a1917",
          padding: "7rem 2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              color: "#f5f4f0",
              marginBottom: "1.25rem",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Start with one repo.
            <br />
            <em style={{ color: "#5a564f" }}>Free, forever.</em>
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "#908a82",
              marginBottom: "2.5rem",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
            }}
          >
            No credit card. No trial period. Just connect a repo and start understanding your history.
          </p>
          <a
            href="/login"
            className="btn btn-primary"
            style={{
              background: "#f5f4f0",
              color: "#1a1917",
              borderColor: "#f5f4f0",
              padding: "0.875rem 2.25rem",
              fontSize: "0.9375rem",
              borderRadius: "6px",
            }}
          >
            Get started with GitHub →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="gl-footer">
        <span className="gl-wordmark" style={{ fontSize: "1.1rem" }}>GitLore</span>
        <span>© 2024 GitLore. All rights reserved.</span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <a href="#" style={{ color: "#908a82" }}>Privacy</a>
          <a href="#" style={{ color: "#908a82" }}>Terms</a>
          <a href="https://github.com" style={{ color: "#908a82" }}>GitHub</a>
        </div>
      </footer>
    </>
  );
}
