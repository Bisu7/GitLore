import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import { pipeline } from "@xenova/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const prisma = new PrismaClient();

import { getExtractor } from "../utils/embedding";

export const embedCommitsWorker = new Worker('embed-commits', async (job) => {
    try {
        const { commitId, repoId } = job.data;

        const commit = await prisma.commit.findUnique({
            where: { id: commitId },
            include: {
                prs: {
                    include: {
                        comments: true
                    }
                }
            }
        });

        if (!commit) {
            throw new Error(`Commit ${commitId} not found`);
        }

        console.log(`Embedding commit ${commit.sha}...`);

        let document = `Commit Message: ${commit.message}\n`;
        document += `Author: ${commit.authorName || ''} <${commit.authorEmail || ''}>\n`;

        for (const pr of commit.prs) {
            document += `\nPull Request: ${pr.title}\n`;
            if (pr.body) document += `PR Body: ${pr.body}\n`;

            const sortedComments = pr.comments.sort((a, b) => b.body.length - a.body.length).slice(0, 5);
            for (const comment of sortedComments) {
                document += `Comment by ${comment.authorLogin}: ${comment.body}\n`;
            }
        }

        document = document.slice(0, 6000);

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 64,
        });

        const chunks = await splitter.createDocuments([document]);

        const extract = await getExtractor();

        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i].pageContent;

            const output = await extract(chunkText, { pooling: 'mean', normalize: true });
            const vectorArray = Array.from(output.data);

            // Format for pgvector: '[0.1, 0.2, ...]'
            const vectorString = `[${vectorArray.join(',')}]`;

            // Prepare metadata
            const metadata = {
                chunkIndex: i,
                totalChunks: chunks.length,
                sha: commit.sha,
            };

            // Insert using raw SQL because Prisma's `Unsupported` type requires raw insertions
            await prisma.$executeRaw`
                INSERT INTO "EmbeddingChunk" ("id", "repoId", "commitId", "content", "metadata", "createdAt", "embedding")
                VALUES (
                    gen_random_uuid()::text, 
                    ${repoId}, 
                    ${commitId}, 
                    ${chunkText}, 
                    ${metadata}::jsonb, 
                    NOW(), 
                    ${vectorString}::vector
                )
            `;
        }

        console.log(`Successfully embedded ${chunks.length} chunks for commit ${commit.sha}`);

    } catch (err) {
        console.error(`Failed to embed commit ${job.data.commitId}:`, err);
        throw err;
    }
}, { connection: { host: '127.0.0.1', port: 6379 } });
