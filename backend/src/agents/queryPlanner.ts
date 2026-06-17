import { GoogleGenAI, Type } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import { embedText } from '../utils/embedding';
import { graphTraverse, getModuleActivity } from '../lib/graphQueries';

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const vectorSearchDeclaration = {
    name: "vector_search",
    description: "Performs semantic search to find commits related to a natural language query.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: { type: Type.STRING, description: "The natural language query to search for." },
            repoId: { type: Type.STRING, description: "The repository ID." },
            limit: { type: Type.INTEGER, description: "Number of results to return (default 5)." }
        },
        required: ["query", "repoId"]
    }
};

const graphTraverseDeclaration = {
    name: "graph_traverse",
    description: "Runs a Neo4j Cypher traversal to find related nodes in the knowledge graph.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            repoId: { type: Type.STRING },
            startNodeType: { type: Type.STRING, description: "Type of starting node (e.g. 'Commit', 'File', 'Module', 'Author')." },
            startNodeProperty: { type: Type.STRING, description: "Property to match on the starting node (e.g. 'sha' for Commit, 'path' for File)." },
            startNodeValue: { type: Type.STRING, description: "The value of the property to match." },
            relationshipType: { type: Type.STRING, description: "The relationship type to traverse (e.g. 'PARENT_OF', 'TOUCHES', 'BELONGS_TO')." },
            hops: { type: Type.INTEGER, description: "Maximum number of relationship hops." }
        },
        required: ["repoId", "startNodeType", "startNodeProperty", "startNodeValue", "relationshipType"]
    }
};

const filterByDateDeclaration = {
    name: "filter_by_date",
    description: "Filters an array of commit objects by a date range.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            commits: { type: Type.ARRAY, description: "Array of commit objects.", items: { type: Type.OBJECT } },
            fromDate: { type: Type.STRING, description: "Start date in ISO format." },
            toDate: { type: Type.STRING, description: "End date in ISO format." }
        },
        required: ["commits", "fromDate", "toDate"]
    }
};

const getModuleTimelineDeclaration = {
    name: "get_module_timeline",
    description: "Gets the timeline of commit activity for a specific module within a date range.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            repoId: { type: Type.STRING },
            moduleName: { type: Type.STRING },
            fromDate: { type: Type.STRING, description: "Start date in ISO format." },
            toDate: { type: Type.STRING, description: "End date in ISO format." }
        },
        required: ["repoId", "moduleName", "fromDate", "toDate"]
    }
};

const executeVectorSearch = async (args: any) => {
    const { query, repoId, limit = 5 } = args;
    const queryVector = await embedText(query);
    const vectorString = `[${queryVector.join(',')}]`;

    const chunks: any[] = await prisma.$queryRaw`
        SELECT ec."commitId", ec."content", (ec."embedding" <=> ${vectorString}::vector) as distance
        FROM "EmbeddingChunk" ec
        WHERE ec."repoId" = ${repoId}
        ORDER BY distance ASC
        LIMIT ${Number(limit)}
    `;

    const commitIds = [...new Set(chunks.map(c => c.commitId))].filter(Boolean) as string[];
    const commits = await prisma.commit.findMany({
        where: { id: { in: commitIds } },
        select: { sha: true, message: true, timestamp: true, authorName: true }
    });
    
    return commits;
};

export const runQueryPlanner = async (userQuery: string, repoId: string, replyStream: any) => {
    const tools = [{
        functionDeclarations: [
            vectorSearchDeclaration,
            graphTraverseDeclaration,
            filterByDateDeclaration,
            getModuleTimelineDeclaration
        ]
    }];

    const systemInstruction = `You are an expert codebase history investigator. You have access to tools that query a Neo4j knowledge graph and a pgvector semantic search engine.
    When asked a complex question (e.g. "what changed in payments after the auth rewrite in March?"), break it down:
    1. Use vector_search to find specific features or concepts (e.g. "auth rewrite").
    2. Identify the commits and their dates.
    3. Use graph_traverse or get_module_timeline to find related activity after those dates.
    4. Synthesize a comprehensive and precise answer. Always cite commit SHAs.`;

    const chat = ai.chats.create({
        model: 'gemini-2.5-pro',
        config: {
            systemInstruction,
            tools
        }
    });

    let messageContent: any = `User Query: ${userQuery}\nRepository ID: ${repoId}`;

    while (true) {
        let isFunctionCall = false;
        let accumulatedFunctionCalls: any[] = [];
        
        try {
            const responseStream = await chat.sendMessageStream(messageContent);
            
            for await (const chunk of responseStream) {
                if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                    isFunctionCall = true;
                    accumulatedFunctionCalls.push(...chunk.functionCalls);
                }
                if (chunk.text && !isFunctionCall) {
                    replyStream.raw.write(`data: ${JSON.stringify({ chunk: chunk.text })}\n\n`);
                }
            }

            if (!isFunctionCall) {
                // Done reasoning
                break;
            }

            // Execute the function calls
            const functionResponses = [];
            for (const call of accumulatedFunctionCalls) {
                let result;
                try {
                    const args = call.args as any;
                    console.log(`[QueryPlanner] Executing ${call.name} with args:`, args);
                    
                    if (call.name === 'vector_search') {
                        result = await executeVectorSearch(args);
                    } else if (call.name === 'graph_traverse') {
                        result = await graphTraverse(args.repoId, args.startNodeType, args.startNodeProperty, args.startNodeValue, args.relationshipType, args.hops || 1);
                    } else if (call.name === 'filter_by_date') {
                        result = (args.commits || []).filter((c: any) => new Date(c.timestamp) >= new Date(args.fromDate) && new Date(c.timestamp) <= new Date(args.toDate));
                    } else if (call.name === 'get_module_timeline') {
                        result = await getModuleActivity(args.repoId, args.moduleName, args.fromDate, args.toDate);
                    } else {
                        result = { error: "Unknown function call" };
                    }
                } catch (err: any) {
                    console.error(`[QueryPlanner] Tool execution failed for ${call.name}:`, err);
                    result = { error: err.message };
                }

                functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: { result }
                    }
                });
            }

            // Set the next message content to the function responses so the loop continues
            messageContent = functionResponses;

        } catch (err: any) {
            console.error("[QueryPlanner] Error during Gemini stream:", err);
            replyStream.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            break;
        }
    }
    
    replyStream.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
};
