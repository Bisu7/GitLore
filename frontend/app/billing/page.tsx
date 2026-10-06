"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/posthog";

interface SubscriptionData {
  plan: "FREE" | "PRO" | "TEAM";
  status: string;
  currentPeriodEnd: string | null;
  hasSubscription: boolean;
  usage: {
    repoCount: number;
    maxRepos: number | null;
    queryCount: number;
    maxQueries: number | null;
  };
}

function BillingContent() {
  const searchParams = useSearchParams();
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "info" | "error"; message: string } | null>(null);

  useEffect(() => {
    // Check URL params for Stripe redirect feedback
    if (searchParams.get("success")) {
      setBanner({
        type: "success",
        message: "Payment successful! Your subscription plan has been upgraded.",
      });
      trackEvent("upgrade_completed");
    } else if (searchParams.get("canceled")) {
      setBanner({
        type: "info",
        message: "Checkout canceled. Your current plan remains unchanged.",
      });
    }

    const fetchSubscription = async () => {
      try {
        const res = await fetch("/api/billing/subscription");
        if (res.ok) {
          const data = await res.json();
          setSubData(data);
        } else {
          // Fallback default
          setSubData({
            plan: "FREE",
            status: "active",
            currentPeriodEnd: null,
            hasSubscription: false,
            usage: {
              repoCount: 1,
              maxRepos: 1,
              queryCount: 12,
              maxQueries: 50,
            },
          });
        }
      } catch (err) {
        console.error("Failed to load subscription details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [searchParams]);

  const handleUpgrade = async (plan: "PRO" | "TEAM") => {
    setActionLoading(`upgrade-${plan}`);
    trackEvent("upgrade_clicked", { plan });

    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (data.url || data.checkoutUrl) {
        window.location.href = data.url || data.checkoutUrl;
      } else {
        alert(data.error || "Failed to create Stripe checkout session.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting billing service.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleManagePortal = async () => {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/billing/portal");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open Stripe Customer Portal.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting portal service.");
    } finally {
      setActionLoading(null);
    }
  };

  const currentPlan = subData?.plan || "FREE";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0c11",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif",
        padding: "3rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Navigation / Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3rem" }}>
          <div>
            <a href="/dashboard" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "0.875rem" }}>
              ← Back to Dashboard
            </a>
            <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: "0.5rem 0 0", letterSpacing: "-0.02em" }}>
              Plans & Billing
            </h1>
          </div>
          {subData?.hasSubscription && (
            <button
              onClick={handleManagePortal}
              disabled={actionLoading === "portal"}
              style={{
                background: "#272533",
                border: "1px solid #3e3a52",
                color: "#e4e4e7",
                padding: "0.625rem 1.25rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {actionLoading === "portal" ? "Loading..." : "Manage Subscription"}
            </button>
          )}
        </div>

        {/* Banner notification */}
        {banner && (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "10px",
              marginBottom: "2rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              background: banner.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(139, 92, 246, 0.15)",
              border: `1px solid ${banner.type === "success" ? "rgba(34, 197, 94, 0.4)" : "rgba(139, 92, 246, 0.4)"}`,
              color: banner.type === "success" ? "#4ade80" : "#c4b5fd",
            }}
          >
            {banner.message}
          </div>
        )}

        {/* Current Usage Overview Card */}
        {subData && (
          <div
            style={{
              background: "#16151c",
              border: "1px solid #282633",
              borderRadius: "14px",
              padding: "1.5rem",
              marginBottom: "3rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.5rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.8125rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Current Active Plan
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.35rem" }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ffffff" }}>{currentPlan}</span>
                <span
                  style={{
                    background: "rgba(139, 92, 246, 0.2)",
                    color: "#a78bfa",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {subData.status.toUpperCase()}
                </span>
              </div>
              {subData.currentPeriodEnd && (
                <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: "0.25rem" }}>
                  Renews: {new Date(subData.currentPeriodEnd).toLocaleDateString()}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: "0.8125rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Repositories Connected
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.35rem", color: "#ffffff" }}>
                {subData.usage.repoCount}{" "}
                <span style={{ fontSize: "0.9375rem", fontWeight: 400, color: "#71717a" }}>
                  / {subData.usage.maxRepos ? subData.usage.maxRepos : "Unlimited"}
                </span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.8125rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Queries This Month
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.35rem", color: "#ffffff" }}>
                {subData.usage.queryCount}{" "}
                <span style={{ fontSize: "0.9375rem", fontWeight: 400, color: "#71717a" }}>
                  / {subData.usage.maxQueries ? subData.usage.maxQueries : "Unlimited"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "2rem",
            alignItems: "stretch",
          }}
        >
          {/* FREE PLAN */}
          <div
            style={{
              background: currentPlan === "FREE" ? "#1a1824" : "#131218",
              border: currentPlan === "FREE" ? "2px solid #8b5cf6" : "1px solid #262432",
              borderRadius: "16px",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            {currentPlan === "FREE" && (
              <div
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "24px",
                  background: "#8b5cf6",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  textTransform: "uppercase",
                }}
              >
                Current Plan
              </div>
            )}
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Free</h3>
              <p style={{ color: "#a1a1aa", fontSize: "0.875rem", minHeight: "40px" }}>
                Perfect for individual developers exploring a personal open-source repo.
              </p>
              <div style={{ margin: "1.5rem 0" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800 }}>$0</span>
                <span style={{ color: "#71717a", fontSize: "1rem" }}> / month</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.875rem", fontSize: "0.875rem", color: "#d4d4d8" }}>
                <li>✓ <strong>1 GitHub repository</strong></li>
                <li>✓ <strong>6 months</strong> commit history</li>
                <li>✓ <strong>50 semantic queries</strong> / month</li>
                <li>✓ Basic vector search & commit explanations</li>
                <li>✓ Public community support</li>
              </ul>
            </div>
            <button
              disabled
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "10px",
                border: "1px solid #3f3c4e",
                background: "#22202b",
                color: "#71717a",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "not-allowed",
              }}
            >
              {currentPlan === "FREE" ? "Active Plan" : "Downgrade via Support"}
            </button>
          </div>

          {/* PRO PLAN */}
          <div
            style={{
              background: currentPlan === "PRO" ? "#1e1a30" : "linear-gradient(180deg, #1b172a 0%, #141220 100%)",
              border: currentPlan === "PRO" ? "2px solid #a855f7" : "1px solid #7c3aed",
              borderRadius: "16px",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              boxShadow: "0 0 35px rgba(124, 58, 237, 0.2)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-12px",
                right: "24px",
                background: currentPlan === "PRO" ? "#a855f7" : "#7c3aed",
                color: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                textTransform: "uppercase",
              }}
            >
              {currentPlan === "PRO" ? "Current Plan" : "Most Popular"}
            </div>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#f3e8ff" }}>Pro</h3>
              <p style={{ color: "#c4b5fd", fontSize: "0.875rem", minHeight: "40px" }}>
                For engineering leads, contractors, and growing software teams.
              </p>
              <div style={{ margin: "1.5rem 0" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "#ffffff" }}>$29</span>
                <span style={{ color: "#a1a1aa", fontSize: "1rem" }}> / month</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.875rem", fontSize: "0.875rem", color: "#e9d5ff" }}>
                <li>✓ <strong>10 GitHub repositories</strong></li>
                <li>✓ <strong>Unlimited commit history</strong></li>
                <li>✓ <strong>Unlimited AI queries</strong></li>
                <li>✓ Interactive D3 Timeline Explorer</li>
                <li>✓ Jira & Linear bidirectional sync</li>
                <li>✓ Slack bot notifications</li>
                <li>✓ Priority email support</li>
              </ul>
            </div>
            {currentPlan === "PRO" ? (
              <button
                onClick={handleManagePortal}
                disabled={actionLoading === "portal"}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "10px",
                  border: "none",
                  background: "#7c3aed",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                {actionLoading === "portal" ? "Opening..." : "Manage Subscription"}
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade("PRO")}
                disabled={actionLoading === "upgrade-PRO"}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "10px",
                  border: "none",
                  background: "#8b5cf6",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
              >
                {actionLoading === "upgrade-PRO" ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            )}
          </div>

          {/* TEAM PLAN */}
          <div
            style={{
              background: currentPlan === "TEAM" ? "#1e1a30" : "#131218",
              border: currentPlan === "TEAM" ? "2px solid #3b82f6" : "1px solid #262432",
              borderRadius: "16px",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            {currentPlan === "TEAM" && (
              <div
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "24px",
                  background: "#3b82f6",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  textTransform: "uppercase",
                }}
              >
                Current Plan
              </div>
            )}
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Team</h3>
              <p style={{ color: "#a1a1aa", fontSize: "0.875rem", minHeight: "40px" }}>
                For large tech organizations with monorepos and mission-critical knowledge graphs.
              </p>
              <div style={{ margin: "1.5rem 0" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800 }}>$199</span>
                <span style={{ color: "#71717a", fontSize: "1rem" }}> / month</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.875rem", fontSize: "0.875rem", color: "#d4d4d8" }}>
                <li>✓ <strong>Unlimited GitHub repositories</strong></li>
                <li>✓ <strong>Unlimited queries & history</strong> (50,000+ commit monorepo support)</li>
                <li>✓ <strong>Neo4j Knowledge Graph Traversal</strong></li>
                <li>✓ <strong>Architectural Drift Detection</strong></li>
                <li>✓ Multi-tool AI Agent Query Planner</li>
                <li>✓ 500 requests/minute rate limit</li>
                <li>✓ Dedicated Slack channel & 99.9% uptime SLA</li>
              </ul>
            </div>
            {currentPlan === "TEAM" ? (
              <button
                onClick={handleManagePortal}
                disabled={actionLoading === "portal"}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "10px",
                  border: "none",
                  background: "#3b82f6",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                {actionLoading === "portal" ? "Opening..." : "Manage Subscription"}
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade("TEAM")}
                disabled={actionLoading === "upgrade-TEAM"}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "10px",
                  border: "1px solid #383547",
                  background: "#22202c",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                {actionLoading === "upgrade-TEAM" ? "Redirecting..." : "Upgrade to Team"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0d0c11", color: "#a1a1aa", padding: "3rem" }}>Loading billing plans...</div>}>
      <BillingContent />
    </Suspense>
  );
}
