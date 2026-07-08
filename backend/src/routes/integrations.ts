import { error } from "console";
import { FastifyInstance } from "fastify";
import { request } from "http";
import { buffer } from "stream/consumers";

const authenticate = async (request: any, reply: any) => {
    try {
        const token = request.cookies.gitlore_token;
        if (!token) return reply.status(401).send({ error: 'unauthorized' });
        const decoded = request.server.jwt.verify(token);
        request.user = decoded;
    } catch {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
};

// extract plain text from Jira Atlassian Doc format
function adfToText(node: any): string {
    if (!node) return '';
    if (node.type == 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(adfToText).join(' ');
    }
    return '';
}

export default async function integrationRoutes(fastify: FastifyInstance) {
    fastify.get('/integrations/jira/connect', { preHandler: authenticate }, async (request: any, reply) => {
        const { repoId } = request.query as { repoId: string };
        if (!repoId) {
            return reply.status(400).send({ error: 'repoId is required' });
        }
        const state = Buffer.from(
            JSON.stringify({ repoId, userId: request.user.id })
        ).toString('base64');

        const params = new URLSearchParams({
            audience: 'api.atlassian.com',
            client_id: process.env.JIRA_CLIENT_ID!,
            scope: 'read:jira-work read:jira-user offline_access',
            redirect_url: process.env.JIRA_REDIRECT_URI!,
            state,
            response_type: 'code',
            prompt: 'consent',
        });

        const url = `https://auth.atlassian.com/authorize?${params.toString()}`;
        return reply.send({ url });
    });

    fastify.get('/integration/jira/callback', async (request: any, reply) => {
        const { code, state } = request.query as { code: string; state: string };
        const { repoId, userId } = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));

        const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: process.env.JIRA_CLIENT_ID,
                client_secret: process.env.JIRA_CLIENT_SECRET,
                code,
                redirect_url: process.env.JIRA_REDIRECT_URI,
            }),
        });
        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.log('[JIRA Callback] Token exchange Failed', err);
            return reply.status(500).send({ error: 'Jira token exchange failed' });
        }
    });
}