"use client";

import React, { useEffect, useState } from 'react';
import { DashboardSummary } from '@repo/types';

export default function OrgDashboardPage() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [repos, setRepos] = useState<any[]>([]); // Assuming basic repo type
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const sumRes = await fetch('/api/dashboard/summary');
                if (sumRes.ok) setSummary(await sumRes.json());
                
                const repRes = await fetch('/api/repos/connected');
                if (repRes.ok) {
                    const reposData = await repRes.json();
                    if (Array.isArray(reposData) && reposData.length === 0) {
                        window.location.href = '/onboarding';
                        return;
                    }
                    setRepos(reposData);
                }
            } catch(e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div style={{ padding: '40px', color: 'white', background: '#0f0c29', minHeight: '100vh' }}>Loading Dashboard...</div>;
    if (!summary) return <div style={{ padding: '40px', color: 'white', background: '#0f0c29', minHeight: '100vh' }}>Failed to load dashboard.</div>;

    return (
        <div style={{ padding: '40px', background: '#0f0c29', minHeight: '100vh', fontFamily: 'sans-serif', color: 'white' }}>
            <h1 style={{ marginBottom: '30px', fontSize: '32px' }}>Organization Overview</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
                {[
                    { label: 'Repos Connected', value: summary.totalRepos, color: '#3b82f6' },
                    { label: 'Commits Indexed', value: summary.totalCommitsIndexed.toLocaleString(), color: '#8b5cf6' },
                    { label: 'Queries This Week', value: summary.totalQueriesThisWeek, color: '#10b981' },
                    { label: 'Modules Drifting', value: summary.modulesCurrentlyDrifting.length, color: summary.modulesCurrentlyDrifting.length > 0 ? '#ef4444' : '#10b981' },
                ].map((stat, i) => (
                    <div key={i} style={{ background: '#1e1e2e', padding: '24px', borderRadius: '12px', borderLeft: `4px solid ${stat.color}` }}>
                        <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '8px' }}>{stat.label}</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
                <div>
                    <h2 style={{ marginBottom: '20px', fontSize: '24px' }}>Connected Repositories</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {repos.map(repo => {
                            const isDrifting = summary.modulesCurrentlyDrifting.some(m => m.includes(repo.id) || m.includes(repo.fullName)); // approximate
                            return (
                                <div key={repo.id} style={{ background: '#1e1e2e', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0 }}>{repo.fullName}</h3>
                                        <div title={isDrifting ? 'Modules drifting' : 'Healthy'} style={{ width: '12px', height: '12px', borderRadius: '50%', background: isDrifting ? '#ef4444' : '#22c55e' }} />
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#a1a1aa', display: 'flex', gap: '10px' }}>
                                        <span style={{ background: '#2a2a3a', padding: '4px 8px', borderRadius: '4px' }}>{repo.ingestionStatus}</span>
                                        <span>Last synced: {new Date(repo.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <a href={`/repo/${repo.id}`} style={{ textDecoration: 'none' }}>
                                        <button style={{ width: '100%', padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            Explore Repo
                                        </button>
                                    </a>
                                </div>
                            );
                        })}
                        <div style={{ background: '#1e1e2e', border: '2px dashed #3f3f46', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: '150px' }}>
                            <div style={{ color: '#a1a1aa', fontWeight: 'bold' }}>+ Connect New Repo</div>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 style={{ marginBottom: '20px', fontSize: '24px' }}>Recent Queries</h2>
                    <div style={{ background: '#1e1e2e', borderRadius: '12px', overflow: 'hidden' }}>
                        {summary.recentQueries.map((q, i) => (
                            <div key={i} style={{ padding: '16px', borderBottom: i === summary.recentQueries.length - 1 ? 'none' : '1px solid #2a2a3a' }}>
                                <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '6px' }}>"{q.question}"</div>
                                <div style={{ fontSize: '12px', color: '#a1a1aa', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#8b5cf6' }}>{q.repoName}</span>
                                    <span>{new Date(q.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        ))}
                        {summary.recentQueries.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#a1a1aa' }}>No recent queries.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}