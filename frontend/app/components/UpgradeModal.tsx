"use client";

import React, { useEffect, useState } from 'react';
import { trackEvent } from '@/lib/posthog';

interface ModalDetails {
  limitType?: string;
  currentPlan?: string;
  message?: string;
}

export default function UpgradeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<ModalDetails>({
    limitType: 'QUERY_LIMIT',
    currentPlan: 'FREE',
  });
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const handleTrigger = (e: CustomEvent<ModalDetails>) => {
      if (e.detail) {
        setDetails(e.detail);
      }
      setIsOpen(true);
    };

    window.addEventListener('gitlore:upgrade-modal' as any, handleTrigger);

    // Global fetch interceptor to catch any 402 HTTP status
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 402) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          window.dispatchEvent(
            new CustomEvent('gitlore:upgrade-modal', {
              detail: {
                limitType: data.limitType || 'LIMIT_EXCEEDED',
                currentPlan: data.currentPlan || 'FREE',
                message: data.message,
              },
            })
          );
        } catch {
          window.dispatchEvent(
            new CustomEvent('gitlore:upgrade-modal', {
              detail: { limitType: 'LIMIT_EXCEEDED', currentPlan: 'FREE' },
            })
          );
        }
      }
      return response;
    };

    return () => {
      window.removeEventListener('gitlore:upgrade-modal' as any, handleTrigger);
      window.fetch = originalFetch;
    };
  }, []);

  const handleUpgrade = async (plan: 'PRO' | 'TEAM') => {
    setLoadingPlan(plan);
    trackEvent('upgrade_clicked', { plan, limitType: details.limitType });

    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url || data.checkoutUrl) {
        window.location.href = data.url || data.checkoutUrl;
      } else {
        alert(data.error || 'Failed to start checkout session');
      }
    } catch (err) {
      console.error(err);
      alert('Network error initiating upgrade checkout.');
    } finally {
      setLoadingPlan(null);
    }
  };

  if (!isOpen) return null;

  const isQueryLimit = details.limitType === 'QUERY_LIMIT';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        padding: '1.5rem',
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '780px',
          background: '#16151a',
          border: '1px solid #2e2b38',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#f4f4f5',
          fontFamily: "'Inter', sans-serif",
          overflow: 'hidden',
          padding: '2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '0.25rem 0.5rem',
            borderRadius: '6px',
          }}
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '0.75rem',
            }}
          >
            {isQueryLimit ? 'Monthly Query Limit Reached' : 'Repository Limit Reached'}
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#ffffff' }}>
            Unlock Full Historical Depth with GitLore
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', maxWidth: '540px', margin: '0 auto' }}>
            {isQueryLimit
              ? "You've reached your free plan limit of 50 queries this month. Upgrade to Pro for unlimited AI-powered commit archaeology."
              : "You've reached the free plan limit of 1 repository. Upgrade to Pro to connect up to 10 repos with unlimited history."}
          </p>
        </div>

        {/* Pricing Cards Comparison */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}
        >
          {/* FREE CARD */}
          <div
            style={{
              background: '#1f1e26',
              border: '1px solid #2e2b38',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: 0.85,
            }}
          >
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e4e4e7' }}>Free</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.5rem 0' }}>$0</div>
              <p style={{ fontSize: '0.8125rem', color: '#71717a', margin: '0 0 1rem' }}>Your current plan</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8125rem', color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>✓ 1 repository</li>
                <li>✓ 6 months history</li>
                <li>✓ 50 queries/mo</li>
                <li>✓ Basic vector search</li>
              </ul>
            </div>
            <div
              style={{
                marginTop: '1.25rem',
                textAlign: 'center',
                fontSize: '0.8125rem',
                color: '#71717a',
                padding: '0.5rem',
                background: '#18171f',
                borderRadius: '8px',
              }}
            >
              Current Plan
            </div>
          </div>

          {/* PRO CARD (RECOMMENDED) */}
          <div
            style={{
              background: 'linear-gradient(180deg, #241f38 0%, #1c182b 100%)',
              border: '2px solid #8b5cf6',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-10px',
                right: '12px',
                background: '#8b5cf6',
                color: '#ffffff',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
              }}
            >
              Popular
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e4e4e7' }}>Pro</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.5rem 0', color: '#ffffff' }}>
                $29 <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#a1a1aa' }}>/mo</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#c4b5fd', margin: '0 0 1rem' }}>For active devs & teams</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8125rem', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>✓ <strong>10 repositories</strong></li>
                <li>✓ <strong>Unlimited history</strong></li>
                <li>✓ <strong>Unlimited queries</strong></li>
                <li>✓ Slack & Jira sync</li>
                <li>✓ D3 Interactive Timeline</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgrade('PRO')}
              disabled={loadingPlan === 'PRO'}
              style={{
                marginTop: '1.25rem',
                width: '100%',
                padding: '0.625rem',
                borderRadius: '8px',
                border: 'none',
                background: '#8b5cf6',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loadingPlan === 'PRO' ? 'Redirecting...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* TEAM CARD */}
          <div
            style={{
              background: '#1f1e26',
              border: '1px solid #3f3c4d',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e4e4e7' }}>Team</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.5rem 0' }}>
                $199 <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#a1a1aa' }}>/mo</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', margin: '0 0 1rem' }}>For scale engineering orgs</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8125rem', color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>✓ <strong>Unlimited repositories</strong></li>
                <li>✓ <strong>Unlimited queries & history</strong></li>
                <li>✓ Neo4j Knowledge Graph</li>
                <li>✓ Architectural Drift Engine</li>
                <li>✓ Dedicated Slack channel</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgrade('TEAM')}
              disabled={loadingPlan === 'TEAM'}
              style={{
                marginTop: '1.25rem',
                width: '100%',
                padding: '0.625rem',
                borderRadius: '8px',
                border: '1px solid #4c485c',
                background: '#2a2834',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              {loadingPlan === 'TEAM' ? 'Redirecting...' : 'Upgrade to Team'}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: '#71717a' }}>
          <span>Secure checkout via Stripe. Cancel or change plan anytime.</span>
          <a href="/billing" style={{ color: '#8b5cf6', textDecoration: 'none' }} onClick={() => setIsOpen(false)}>
            Full Plan Details →
          </a>
        </div>
      </div>
    </div>
  );
}
