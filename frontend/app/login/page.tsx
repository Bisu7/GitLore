import React from 'react';

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f5f4f0",
      }}
    >
      {/* Left panel + right panel */}
      <div style={{ flex: 1, display: "flex", minHeight: "100vh" }}>

        {/* Left — branding panel */}
        <div
          style={{
            flex: 1,
            background: "#1a1917",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "2.5rem",
            minWidth: 0,
          }}
        >
          <a href="/" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "1.3rem", color: "#f5f4f0", letterSpacing: "-0.03em" }}>
            GitLore
          </a>

          <div>
            <p
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                color: "#f5f4f0",
                lineHeight: 1.2,
                marginBottom: "1.5rem",
                letterSpacing: "-0.02em",
                maxWidth: "420px",
              }}
            >
              "The codebase remembers. <em style={{ color: "#5a564f" }}>You just have to ask.</em>"
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                "Indexes your entire Git history",
                "Links commits to tickets and PRs",
                "Searchable in plain English",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ color: "#3a3835", fontSize: "1rem" }}>—</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#5a564f" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "#3a3835" }}>
            © 2024 GitLore
          </p>
        </div>

        {/* Right — login form */}
        <div
          style={{
            width: "480px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "3rem",
            background: "#ffffff",
            borderLeft: "1px solid #d8d5cf",
          }}
        >
          <h1
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "2rem",
              color: "#1a1917",
              marginBottom: "0.5rem",
              letterSpacing: "-0.01em",
            }}
          >
            Sign in
          </h1>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.875rem",
              color: "#908a82",
              marginBottom: "2.5rem",
            }}
          >
            Connect your GitHub account to get started.
          </p>

          <a
            href="http://localhost:8080/auth/github"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              padding: "0.75rem 1.25rem",
              background: "#1a1917",
              color: "#f5f4f0",
              border: "1px solid #1a1917",
              borderRadius: "6px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s",
              textDecoration: "none",
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </a>

          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.75rem",
              color: "#908a82",
              textAlign: "center",
              marginTop: "1.75rem",
              lineHeight: 1.6,
            }}
          >
            By signing in, you agree to our{" "}
            <a href="#" style={{ color: "#5a564f", textDecoration: "underline" }}>Terms of Service</a>
            {" "}and{" "}
            <a href="#" style={{ color: "#5a564f", textDecoration: "underline" }}>Privacy Policy</a>.
            <br />
            We never store your source code.
          </p>
        </div>
      </div>
    </div>
  );
}
