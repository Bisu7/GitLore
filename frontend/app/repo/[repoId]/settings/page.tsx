"use client";

import React, { useState, useEffect, use } from 'react';

interface Integration {
    provider: string;
    createdAt: string;
    siteUrl: string | null;
}

interface TicketCount {
    source: string;
    count: number;
}

const INTEGRATIONS_CONFIG = [
    {
        id: 'jira',
        name: 'Jira',
        description: 'Import issues from your Atlassian Jira workspace and link them to commits.',
        icon: (
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84zm-4.6 4.6c0 2.4 1.96 4.35 4.35 4.35h1.78v1.71c0 2.4 1.94 4.34 4.35 4.34V7.44a.84.84 0 0 0-.84-.84zm-4.6 4.6c0 2.4 1.96 4.35 4.35 4.35h1.78v1.7c0 2.41 1.94 4.35 4.35 4.35v-9.56a.84.84 0 0 0-.84-.84z"/>
            </svg>
        ),
        color: 'from-blue-500 to-blue-600',
        connectPath: 'jira',
        comingSoon: false,
    },
    {
        id: 'linear',
        name: 'Linear',
        description: 'Sync Linear issues to understand how project work maps to code changes.',
        icon: (
            <svg viewBox="0 0 100 100" className="w-8 h-8" fill="currentColor">
                <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228zM.00189135 46.8891c-.01764375.2833.08887225.5599.28957985.7606L52.3503 99.7085c.2007.2007.4773.3075.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L2.57595 39.4485c-.55186-.5519-1.49117-.2863-1.648174.4782-.465776 2.2686-.778094 4.5932-.925835 6.9624zM4.21093 32.5879c-.14601.3194-.08788.6931.14976.9308L66.4821 95.6391c.2377.2377.6114.2958.9308.1498 1.7861-.8164 3.5171-1.7327 5.1921-2.7408.4328-.2582.4995-.8495.1448-1.2041L8.35572 27.2530c-.35466-.3547-.94596-.2879-1.20412.1448-1.00810 1.6750-1.92438 3.4060-2.74067 5.1921zM12.1076 19.2013c-.2487-.2487-.2837-.6422-.0837-.9335C21.7108 4.45897 37.5924.000000 50.0000.000000c27.6142 0 50 22.3858 50 50 0 12.4076-4.459 28.2892-18.2678 37.9761-.2913.2-.6848.165-.9335-.0837L12.1076 19.2013z"/>
            </svg>
        ),
        color: 'from-purple-500 to-violet-600',
        connectPath: 'linear',
        comingSoon: false,
    },
    {
        id: 'slack',
        name: 'Slack',
        description: 'Get notified in Slack when significant code changes are detected.',
        icon: (
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
        ),
        color: 'from-emerald-500 to-teal-600',
        connectPath: 'slack',
        comingSoon: true,
    },
];

export default function SettingsPage({ params }: { params: Promise<{ repoId: string }> }) {
    const { repoId } = use(params);
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [ticketCounts, setTicketCounts] = useState<TicketCount[]>([]);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [intRes, countRes] = await Promise.all([
                fetch(`/api/repos/${repoId}/integrations`),
                fetch(`/api/repos/${repoId}/tickets/count`),
            ]);
            if (intRes.ok) setIntegrations(await intRes.json());
            if (countRes.ok) setTicketCounts(await countRes.json());
        } catch (err) {
            console.error('Failed to fetch integration data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [repoId]);

    const handleConnect = async (provider: string) => {
        setConnecting(provider);
        try {
            const res = await fetch(`/api/integrations/${provider}/connect?repoId=${repoId}`);
            if (!res.ok) throw new Error('Failed to get connect URL');
            const { url } = await res.json();
            window.location.href = url;
        } catch (err) {
            console.error(`Failed to connect ${provider}:`, err);
            setConnecting(null);
        }
    };

    const getIntegration = (provider: string) =>
        integrations.find((i) => i.provider === provider.toUpperCase());

    const getCount = (source: string) =>
        ticketCounts.find((c) => c.source === source.toUpperCase())?.count ?? 0;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            padding: '40px 24px',
        }}>
            <div style={{ maxWidth: '860px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <a
                            href={`/repo/${repoId}`}
                            style={{
                                color: 'rgba(255,255,255,0.5)',
                                textDecoration: 'none',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                        >
                            ← Back to repo
                        </a>
                    </div>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        color: 'white',
                        margin: '0 0 8px 0',
                        letterSpacing: '-0.5px',
                    }}>
                        Integrations
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', margin: 0 }}>
                        Connect external tools to enrich your repository's knowledge graph.
                    </p>
                </div>

                {/* Cards */}
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '60px' }}>
                        Loading integrations...
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {INTEGRATIONS_CONFIG.map((config) => {
                            const connected = getIntegration(config.id);
                            const count = getCount(config.id);
                            const isConnecting = connecting === config.id;

                            return (
                                <div
                                    key={config.id}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        padding: '24px 28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '20px',
                                        backdropFilter: 'blur(12px)',
                                        transition: 'border-color 0.2s, background 0.2s',
                                        ...(connected ? {
                                            borderColor: 'rgba(74, 222, 128, 0.3)',
                                            background: 'rgba(74, 222, 128, 0.05)',
                                        } : {}),
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '14px',
                                        background: `linear-gradient(135deg, ${config.color.replace('from-', '').replace(' to-', ', ')})`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        flexShrink: 0,
                                    }}>
                                        {config.icon}
                                    </div>

                                    {/* Text */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'white', margin: 0 }}>
                                                {config.name}
                                            </h2>
                                            {/* Status badge */}
                                            {config.comingSoon ? (
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    padding: '2px 10px',
                                                    borderRadius: '99px',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    color: 'rgba(255,255,255,0.5)',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    Coming Soon
                                                </span>
                                            ) : connected ? (
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    padding: '2px 10px',
                                                    borderRadius: '99px',
                                                    background: 'rgba(74, 222, 128, 0.15)',
                                                    color: '#4ade80',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    ● Connected
                                                </span>
                                            ) : (
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    padding: '2px 10px',
                                                    borderRadius: '99px',
                                                    background: 'rgba(255,255,255,0.08)',
                                                    color: 'rgba(255,255,255,0.4)',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    Not Connected
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                                            {config.description}
                                        </p>
                                        {connected && count > 0 && (
                                            <p style={{
                                                color: '#4ade80',
                                                fontSize: '13px',
                                                margin: 0,
                                                fontWeight: '500',
                                            }}>
                                                ✓ {count} ticket{count !== 1 ? 's' : ''} imported
                                            </p>
                                        )}
                                        {connected && count === 0 && (
                                            <p style={{
                                                color: 'rgba(255,255,255,0.35)',
                                                fontSize: '13px',
                                                margin: 0,
                                            }}>
                                                Syncing tickets... (no ticket references found in commits yet)
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    <div style={{ flexShrink: 0 }}>
                                        {config.comingSoon ? (
                                            <button
                                                disabled
                                                style={{
                                                    padding: '10px 22px',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: 'rgba(255,255,255,0.3)',
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    cursor: 'not-allowed',
                                                }}
                                            >
                                                Coming Soon
                                            </button>
                                        ) : connected ? (
                                            <button
                                                onClick={() => handleConnect(config.id)}
                                                style={{
                                                    padding: '10px 22px',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(74, 222, 128, 0.3)',
                                                    background: 'rgba(74, 222, 128, 0.08)',
                                                    color: '#4ade80',
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(74, 222, 128, 0.08)';
                                                }}
                                            >
                                                Reconnect
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(config.id)}
                                                disabled={isConnecting}
                                                style={{
                                                    padding: '10px 22px',
                                                    borderRadius: '10px',
                                                    border: 'none',
                                                    background: isConnecting
                                                        ? 'rgba(255,255,255,0.1)'
                                                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    color: isConnecting ? 'rgba(255,255,255,0.4)' : 'white',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    cursor: isConnecting ? 'not-allowed' : 'pointer',
                                                    boxShadow: isConnecting ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.4)',
                                                    transition: 'all 0.2s',
                                                    minWidth: '100px',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isConnecting) e.currentTarget.style.transform = 'translateY(-1px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                {isConnecting ? 'Redirecting...' : 'Connect'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Info box */}
                <div style={{
                    marginTop: '32px',
                    padding: '18px 22px',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                }}>
                    <strong style={{ color: 'rgba(99, 102, 241, 0.9)' }}>How it works: </strong>
                    When you connect an integration, GitLore scans your commit history for ticket references (e.g. <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>PROJ-123</code> or <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>#456</code>) and fetches the full issue details, enriching your knowledge graph with titles, descriptions, statuses, and assignees.
                </div>
            </div>
        </div>
    );
}
