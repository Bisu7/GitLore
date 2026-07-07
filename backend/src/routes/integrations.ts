import { error } from "console";
import { FastifyInstance } from "fastify";

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
}