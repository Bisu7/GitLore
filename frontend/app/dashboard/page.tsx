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

export default function DashboardPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [availableRepos, setAvailableRepos] = useState<GitHubRepo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openModal = async () => {
        setIsModalOpen(true);
        if (availableRepos.length === 0) {
            setIsLoading(true);
            setError(null);
            try {
                // Notice we use /api to hit the proxy we just set up!
                const res = await fetch('/api/repos/available');
                if (!res.ok) throw new Error('Failed to fetch repositories');
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
        try {
            const res = await fetch('/api/repos/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    githubRepoId: repo.githubRepoId,
                    fullName: repo.fullName,
                    defaultBranch: repo.defaultBranch
                })
            });
            if (!res.ok) throw new Error('Failed to connect repository');
            
            setIsModalOpen(false);
            alert(`Successfully connected ${repo.fullName}!`);
        } catch (err: any) {
            alert(err.message || 'Failed to connect repository');
        }
    };

    return (
        <div className='min-h-screen bg-gray-950 p-8 text-white font-sans'>
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className='text-3xl font-bold tracking-tight'>Dashboard</h1>
                        <p className='text-gray-400 mt-1'>Manage your connected GitLore repositories.</p>
                    </div>
                    <button 
                        onClick={openModal}
                        className="bg-indigo-600 hover:bg-indigo-700 transition-colors px-5 py-2.5 rounded-lg font-medium text-sm flex items-center shadow-lg shadow-indigo-500/20"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        Connect Repository
                    </button>
                </div>

                {/* Main Dashboard Content - Placeholder for connected repos */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                    <h3 className="text-xl font-medium mb-2">No repositories connected</h3>
                    <p className="text-gray-400 max-w-md mx-auto mb-6">You haven't connected any repositories yet. Connect one to start building your GitLore knowledge base.</p>
                    <button onClick={openModal} className="text-indigo-400 hover:text-indigo-300 font-medium">
                        Connect your first repo &rarr;
                    </button>
                </div>
            </div>

            {/* Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Connect a GitHub Repository</h2>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-colors p-1"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="text-gray-400">Loading your repositories...</p>
                                </div>
                            ) : error ? (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 flex items-start">
                                    <svg className="w-5 h-5 mr-3 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    <p>{error}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {availableRepos.length === 0 ? (
                                        <p className="text-center text-gray-400 py-8">No repositories found.</p>
                                    ) : (
                                        availableRepos.map((repo) => (
                                            <div key={repo.githubRepoId} className="flex items-center justify-between p-4 rounded-xl border border-gray-800 bg-gray-800/30 hover:bg-gray-800/60 transition-colors">
                                                <div className="flex items-center space-x-4">
                                                    <div className="bg-gray-800 p-2 rounded-lg text-gray-400">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium flex items-center">
                                                            {repo.fullName}
                                                            {repo.private && (
                                                                <span className="ml-2 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">Private</span>
                                                            )}
                                                        </h4>
                                                        <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                                                            {repo.language && (
                                                                <span className="flex items-center">
                                                                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                                                                    {repo.language}
                                                                </span>
                                                            )}
                                                            <span className="flex items-center">
                                                                <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                                                {repo.stargazersCount}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => connectRepo(repo)}
                                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors border border-white/10"
                                                >
                                                    Connect
                                                </button>
                                            </div>
                                        ))
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