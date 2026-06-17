import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { getNeo4jDriver } from "../lib/neo4j";
import { getModuleFromFilePath } from "../utils/moduleDetector";

const prisma = new PrismaClient();

export const buildGraphWorker = new Worker('build-graph', async (job) => {
    const { repoId } = job.data;
    
    console.log(`Starting to build graph for repo: ${repoId}`);
    
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
        // Find all commits for this repo with their related data
        const commits = await prisma.commit.findMany({
            where: { repoId },
            include: {
                files: true,
                ticketRefs: true,
                prs: true,
            }
        });
        
        console.log(`Found ${commits.length} commits to process for graph construction.`);

        for (const commit of commits) {
            // MERGE Commit
            await session.executeWrite(async tx => await tx.run(`
                MERGE (c:Commit {repoId: $repoId, sha: $sha})
                SET c.message = $message, c.timestamp = $timestamp
            `, {
                repoId,
                sha: commit.sha,
                message: commit.message,
                timestamp: commit.timestamp.toISOString()
            }));

            // MERGE Author
            if (commit.authorEmail) {
                await session.executeWrite(async tx => await tx.run(`
                    MERGE (a:Author {email: $email})
                    ON CREATE SET a.name = $name
                    WITH a
                    MATCH (c:Commit {repoId: $repoId, sha: $sha})
                    MERGE (a)-[r:AUTHORED]->(c)
                    SET r.timestamp = $timestamp
                `, {
                    email: commit.authorEmail,
                    name: commit.authorName || 'Unknown',
                    repoId,
                    sha: commit.sha,
                    timestamp: commit.timestamp.toISOString()
                }));
            }

            // MERGE Files and Modules
            for (const file of commit.files) {
                const moduleName = getModuleFromFilePath(file.filePath);
                
                await session.executeWrite(async tx => await tx.run(`
                    MATCH (c:Commit {repoId: $repoId, sha: $sha})
                    MERGE (f:File {repoId: $repoId, path: $filePath})
                    MERGE (c)-[t:TOUCHES]->(f)
                    SET t.additions = $additions, t.deletions = $deletions
                    
                    MERGE (m:Module {repoId: $repoId, name: $moduleName})
                    MERGE (f)-[:BELONGS_TO]->(m)
                `, {
                    repoId,
                    sha: commit.sha,
                    filePath: file.filePath,
                    additions: file.additions,
                    deletions: file.deletions,
                    moduleName
                }));
            }

            // MERGE Tickets
            for (const ticket of commit.ticketRefs) {
                await session.executeWrite(async tx => await tx.run(`
                    MATCH (c:Commit {repoId: $repoId, sha: $sha})
                    MERGE (t:Ticket {repoId: $repoId, externalId: $externalId, source: $source})
                    MERGE (c)-[:REFS_TICKET]->(t)
                `, {
                    repoId,
                    sha: commit.sha,
                    externalId: ticket.externalId,
                    source: ticket.source
                }));
            }

            // MERGE PRs
            for (const pr of commit.prs) {
                await session.executeWrite(async tx => await tx.run(`
                    MATCH (c:Commit {repoId: $repoId, sha: $sha})
                    MERGE (p:PR {repoId: $repoId, number: $number})
                    SET p.title = $title
                    MERGE (c)-[:HAS_PR]->(p)
                `, {
                    repoId,
                    sha: commit.sha,
                    number: pr.githubPrNumber,
                    title: pr.title
                }));
            }
            
            // MERGE Parent Commits
            if (commit.parentShas && commit.parentShas.length > 0) {
                for (const parentSha of commit.parentShas) {
                    await session.executeWrite(async tx => await tx.run(`
                        MATCH (c:Commit {repoId: $repoId, sha: $sha})
                        MERGE (p:Commit {repoId: $repoId, sha: $parentSha})
                        MERGE (p)-[:PARENT_OF]->(c)
                    `, {
                        repoId,
                        sha: commit.sha,
                        parentSha
                    }));
                }
            }
        }
        
        console.log(`Successfully built graph for repo: ${repoId}`);
        
    } catch (err) {
        console.error(`Failed to build graph for repo ${repoId}:`, err);
        throw err;
    } finally {
        await session.close();
    }
}, { connection: { host: '127.0.0.1', port: 6379 } });
