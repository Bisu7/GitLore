import { FastifyInstance } from "fastify";

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
    })
}