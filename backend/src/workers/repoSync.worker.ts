import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import IORedis from "ioredis";

const prisma = new PrismaClient();

// Removed IORedis instance as BullMQ can instantiate it directly from connection options

export const repoSyncWorker = new Worker('repo-sync', async (job) => {
    try {
        const { repoId } = job.data;

        const repo = await prisma.repo.findUnique({
            where: { id: repoId },
            include: { user: true },
        });

        if (!repo) {
            throw new Error("Repository Not found.");
        }

        const user = repo.user;
        if (!user.accessToken) {
            throw new Error("Github Token missing");
        }

        await prisma.repo.update({
            where: { id: repoId },
            data: {
                ingestionStatus: "PROCESSING",
                ingestionProgress: 0,
            },
        });

        // clone repo
        const repoPath = path.join(process.cwd(), "tmp", "repos", repoId);
        if (fs.existsSync(repoPath)) {
            fs.rmSync(repoPath, { recursive: true, force: true });
        }
        fs.mkdirSync(repoPath, { recursive: true });

        const cloneUrl = `https://${user.accessToken}@github.com/${repo.fullName}.git`;
        console.log(`Cloning the repo ${repo.fullName}....`);

        await simpleGit().clone(cloneUrl, repoPath);
        const git = simpleGit(repoPath);

        const log = await git.log(['--all']);
        const commits = log.all;
        console.log(`Found ${commits.length} commits`);

        const totalCommits = commits.length;
        let processedCommits = 0;

        for (const commit of commits) {
            // Upsert commit to prevent duplicates if multiple jobs run concurrently
            let dbCommit = await prisma.commit.findFirst({
                where: { repoId: repoId, sha: commit.hash }
            });
            
            if (!dbCommit) {
                dbCommit = await prisma.commit.create({
                    data: {
                        repoId: repoId,
                        sha: commit.hash,
                        message: commit.message + (commit.body ? `\n\n${commit.body}` : ''),
                        authorEmail: commit.author_email,
                        authorName: commit.author_name,
                        timestamp: new Date(commit.date),
                        parentShas: [], // simple-git doesn't provide parents easily in standard log
                    }
                });
            } else {
                // If it already exists, skip processing its files to avoid duplicates
                continue;
            }

            // Extract Ticket Refs from message
            const ticketRegex = /([A-Z]+-\d+)|(#\d+)|(closes\s+#\d+)/gi;
            const fullMessage = `${commit.message} ${commit.body || ''}`;
            const matches = [...fullMessage.matchAll(ticketRegex)];
            
            for (const match of matches) {
                const rawRef = match[0];
                let source = "UNKNOWN";
                let externalId = rawRef;
                
                if (rawRef.match(/[A-Z]+-\d+/i)) {
                    source = "JIRA"; // or Linear
                } else if (rawRef.match(/#\d+/)) {
                    source = "GITHUB";
                    externalId = rawRef.match(/#(\d+)/)?.[1] || rawRef;
                }

                await prisma.ticketRef.create({
                    data: {
                        commitId: dbCommit.id,
                        source,
                        externalId,
                        rawRef
                    }
                });
            }

            // Extract changed files via show
            try {
                const showOutput = await git.show(['--patch', '--format=', commit.hash]);
                const patches = showOutput.split(/^diff --git /m).filter(p => p.trim().length > 0);
                for (const patchChunk of patches) {
                    const lines = patchChunk.split('\n');
                    const firstLine = lines[0]; // e.g. "a/backend/.gitignore b/backend/.gitignore"
                    const filePathMatch = firstLine.match(/^a\/(.*?)\s+b\/(.*)$/);
                    if (!filePathMatch) continue;
                    const filePath = filePathMatch[2] || filePathMatch[1];
                    const patch = 'diff --git ' + patchChunk.trim();
                    await prisma.commitFile.create({
                        data: {
                            commitId: dbCommit.id,
                            filePath,
                            patch
                        }
                    });
                }
            } catch (err) {
                // Ignore show error for specific commit
            }

            // Fetch Pull Request for this commit
            try {
                const prRes = await fetch(`https://api.github.com/repos/${repo.fullName}/commits/${commit.hash}/pulls`, {
                    headers: {
                        Authorization: `Bearer ${user.accessToken}`,
                        Accept: 'application/vnd.github.groot-preview+json'
                    }
                });

                if (prRes.ok) {
                    const prs = await prRes.json();
                    for (const prData of prs) {
                        const prInfo = await prisma.pR.create({
                            data: {
                                repoId,
                                commitId: dbCommit.id,
                                githubPrNumber: prData.number,
                                title: prData.title,
                                body: prData.body,
                                state: prData.state,
                                mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
                            }
                        });

                        // Fetch review comments
                        const commentsRes = await fetch(`https://api.github.com/repos/${repo.fullName}/pulls/${prData.number}/comments`, {
                            headers: {
                                Authorization: `Bearer ${user.accessToken}`,
                            }
                        });

                        if (commentsRes.ok) {
                            const comments = await commentsRes.json();
                            for (const c of comments) {
                                await prisma.pRComment.create({
                                    data: {
                                        prId: prInfo.id,
                                        githubCommentId: c.id.toString(),
                                        authorLogin: c.user?.login || 'unknown',
                                        body: c.body,
                                        createdAt: new Date(c.created_at)
                                    }
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                // Ignore API errors
            }

            processedCommits++;
            
            // Update progress every 50 commits
            if (processedCommits % 50 === 0) {
                await prisma.repo.update({
                    where: { id: repoId },
                    data: {
                        ingestionProgress: Math.round((processedCommits / totalCommits) * 100)
                    }
                });
            }
        }

        // Finalize
        await prisma.repo.update({
            where: { id: repoId },
            data: {
                ingestionStatus: "COMPLETE",
                ingestionProgress: 100,
            }
        });
        
        console.log(`Successfully processed ${processedCommits} commits for ${repo.fullName}`);
        console.log("Enqueuing commits for embedding...");
        
        const { Queue } = require("bullmq");
        const embedQueue = new Queue('embed-commits', { connection: { host: '127.0.0.1', port: 6379 } });
        
        for (const commit of commits) {
            // Need the DB commit ID, but we only have hash. Let's fetch it from DB to get the cuid
            const dbCommit = await prisma.commit.findFirst({
                where: { repoId, sha: commit.hash }
            });
            if (dbCommit) {
                await embedQueue.add('embed', { commitId: dbCommit.id, repoId });
            }
        }
        
        console.log("Finished enqueuing embedding jobs");
        
    } catch (err: any) {
        console.error("Worker failed", err);
        if (job.data.repoId) {
            await prisma.repo.update({
                where: { id: job.data.repoId },
                data: {
                    ingestionStatus: "FAILED",
                }
            });
        }
        throw err;
    }
}, { connection: { host: '127.0.0.1', port: 6379 } });