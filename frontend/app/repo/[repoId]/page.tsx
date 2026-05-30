import React from 'react';

// Next.js dynamic route parameters
export default function RepoPage({ params }: { params: { repoId: string } }) {
    return (
        <div className="min-h-screen bg-gray-950 p-8 text-white">
            <h1 className="mb-4 text-3xl font-bold">Repository Details</h1>
            <p className="text-gray-400">Viewing repository: {params.repoId}</p>
        </div>
    );
}
